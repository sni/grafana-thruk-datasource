package plugin

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana-plugin-sdk-go/data"
)

var (
	_ backend.QueryDataHandler      = (*Datasource)(nil)
	_ backend.CheckHealthHandler    = (*Datasource)(nil)
	_ backend.CallResourceHandler   = (*Datasource)(nil)
	_ instancemgmt.InstanceDisposer = (*Datasource)(nil)
)

const defaultLimit = 1000

type queryModel struct {
	Table     string   `json:"table"`
	Columns   []string `json:"columns"`
	Condition string   `json:"condition"`
	Limit     int      `json:"limit"`
	Type      string   `json:"type"`
}

type metaColumn struct {
	Name   string      `json:"name"`
	Type   string      `json:"type"`
	Config interface{} `json:"config"`
}

type thrukMeta struct {
	Columns []metaColumn `json:"columns"`
}

type thrukResponse struct {
	Data []map[string]interface{} `json:"data"`
	Meta *thrukMeta               `json:"meta"`
}

type Datasource struct {
	url        string
	basicAuth  string
	httpClient *http.Client
	logger     *log.Logger
	logFile    *os.File
}

func NewDatasource(_ context.Context, settings backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
	u := strings.TrimRight(settings.URL, "/")

	logger, logFile := createLogger()

	return &Datasource{
		url:       u,
		basicAuth: buildBasicAuth(settings),
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
		logger:  logger,
		logFile: logFile,
	}, nil
}

func (d *Datasource) Dispose() {
	if d.logger != nil {
		d.logger.Println("plugin instance disposed")
	}
	if d.logFile != nil {
		d.logFile.Close()
	}
}

func createLogger() (*log.Logger, *os.File) {
	logDir := "/root/sni-thruk-datasource/logs"
	os.MkdirAll(logDir, 0755)

	filename := logDir + "/plugin.log"
	f, err := os.OpenFile(filename, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return log.New(os.Stderr, "[thruk] ", log.LstdFlags), nil
	}

	return log.New(f, "", log.LstdFlags), f
}

func (d *Datasource) CheckHealth(ctx context.Context, _ *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	d.logger.Println("[CheckHealth] testing connection")

	thrukURL := d.url + "/r/v1/thruk?columns=thruk_version"
	d.logger.Printf("[CheckHealth] GET %s", thrukURL)

	req, err := http.NewRequestWithContext(ctx, "GET", thrukURL, nil)
	if err != nil {
		d.logger.Printf("[CheckHealth] failed to create request: %v", err)
		return &backend.CheckHealthResult{
			Status:  backend.HealthStatusError,
			Message: fmt.Sprintf("Failed to create request: %v", err),
		}, nil
	}
	d.setAuth(req)

	start := time.Now()
	resp, err := d.httpClient.Do(req)
	elapsed := time.Since(start)
	if err != nil {
		d.logger.Printf("[CheckHealth] connection failed after %v: %v", elapsed, err)
		return &backend.CheckHealthResult{
			Status:  backend.HealthStatusError,
			Message: fmt.Sprintf("Connection failed: %v", err),
		}, nil
	}
	defer resp.Body.Close()

	d.logger.Printf("[CheckHealth] response %d (%v)", resp.StatusCode, elapsed)

	if resp.StatusCode != http.StatusOK {
		return &backend.CheckHealthResult{
			Status:  backend.HealthStatusError,
			Message: fmt.Sprintf("Unexpected status %d", resp.StatusCode),
		}, nil
	}

	var result struct {
		ThrukVersion string `json:"thruk_version"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		d.logger.Printf("[CheckHealth] failed to parse response: %v", err)
		return &backend.CheckHealthResult{
			Status:  backend.HealthStatusError,
			Message: fmt.Sprintf("Failed to parse response: %v", err),
		}, nil
	}
	if result.ThrukVersion == "" {
		d.logger.Println("[CheckHealth] no thruk_version in response")
		return &backend.CheckHealthResult{
			Status:  backend.HealthStatusError,
			Message: "Invalid URL, did not find Thruk version in response",
		}, nil
	}

	d.logger.Printf("[CheckHealth] connected to Thruk v%s", result.ThrukVersion)
	return &backend.CheckHealthResult{
		Status:  backend.HealthStatusOk,
		Message: "Successfully connected to Thruk v" + result.ThrukVersion,
	}, nil
}

func (d *Datasource) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	d.logger.Printf("[QueryData] received %d queries", len(req.Queries))

	response := backend.NewQueryDataResponse()
	for _, q := range req.Queries {
		res := d.query(ctx, q)
		response.Responses[q.RefID] = res
	}
	return response, nil
}

func (d *Datasource) query(ctx context.Context, query backend.DataQuery) backend.DataResponse {
	var qm queryModel
	if err := json.Unmarshal(query.JSON, &qm); err != nil {
		d.logger.Printf("[QueryData] refId=%s unmarshal error: %v", query.RefID, err)
		return backend.ErrDataResponse(backend.StatusBadRequest, fmt.Sprintf("json unmarshal: %v", err.Error()))
	}

	d.logger.Printf("[QueryData] refId=%s table=%s columns=%v condition=%q limit=%d type=%s",
		query.RefID, qm.Table, qm.Columns, qm.Condition, qm.Limit, qm.Type)

	thrukURL := d.buildQueryURL(qm)
	d.logger.Printf("[HTTP] GET %s", thrukURL)

	req, err := http.NewRequestWithContext(ctx, "GET", thrukURL, nil)
	if err != nil {
		d.logger.Printf("[HTTP] failed to create request: %v", err)
		return backend.ErrDataResponse(backend.StatusBadRequest, fmt.Sprintf("failed to create request: %v", err))
	}
	req.Header.Set("X-THRUK-OutputFormat", "wrapped_json")
	d.setAuth(req)

	start := time.Now()
	resp, err := d.httpClient.Do(req)
	elapsed := time.Since(start)
	if err != nil {
		d.logger.Printf("[HTTP] request failed after %v: %v", elapsed, err)
		return backend.ErrDataResponse(backend.StatusBadRequest, fmt.Sprintf("request failed: %v", err))
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		d.logger.Printf("[HTTP] failed to read response: %v", err)
		return backend.ErrDataResponse(backend.StatusBadRequest, fmt.Sprintf("failed to read response: %v", err))
	}

	d.logger.Printf("[HTTP] response %d %s (%v, %d bytes)", resp.StatusCode, resp.Status, elapsed, len(body))

	if resp.StatusCode != http.StatusOK {
		return backend.ErrDataResponse(backend.StatusBadRequest, fmt.Sprintf("thruk returned status %d", resp.StatusCode))
	}

	parseStart := time.Now()
	result := d.parseThrukResponse(body, qm)
	d.logger.Printf("[QueryData] refId=%s parsed in %v", query.RefID, time.Since(parseStart))

	return result
}

func (d *Datasource) buildQueryURL(qm queryModel) string {
	path := strings.TrimPrefix(qm.Table, "/")
	u := fmt.Sprintf("%s/r/v1/%s", d.url, path)

	limit := qm.Limit
	if limit <= 0 {
		limit = defaultLimit
	}
	u += "?limit=" + strconv.Itoa(limit)

	if len(qm.Columns) > 0 && !(len(qm.Columns) == 1 && qm.Columns[0] == "*") {
		u += "&columns=" + url.QueryEscape(strings.Join(qm.Columns, ","))
	}
	if qm.Condition != "" {
		u += "&q=" + url.QueryEscape(qm.Condition)
	}

	return u
}

func (d *Datasource) parseThrukResponse(body []byte, qm queryModel) backend.DataResponse {
	var thrukResp thrukResponse
	if err := json.Unmarshal(body, &thrukResp); err != nil {
		var plainData []map[string]interface{}
		if err2 := json.Unmarshal(body, &plainData); err2 != nil {
			var singleObj map[string]interface{}
			if err3 := json.Unmarshal(body, &singleObj); err3 != nil {
				d.logger.Printf("[QueryData] failed to parse response: %v", err)
				return backend.ErrDataResponse(backend.StatusBadRequest, fmt.Sprintf("failed to parse response: %v", err))
			}
			thrukResp.Data = []map[string]interface{}{singleObj}
		} else {
			thrukResp.Data = plainData
		}
	}

	frame := data.NewFrame("response")

	if len(thrukResp.Data) == 0 {
		d.logger.Printf("[QueryData] empty response, 0 rows returned")
		return backend.DataResponse{Frames: data.Frames{frame}}
	}

	columns := determineColumns(&thrukResp)
	metaColumns := buildMetaColumnMap(&thrukResp)

	for _, col := range columns {
		fieldType := inferFieldType(col, metaColumns)
		field := data.NewFieldFromFieldType(fieldType, len(thrukResp.Data))
		field.Name = col

		for _, row := range thrukResp.Data {
			val := row[col]
			switch fieldType {
			case data.FieldTypeTime:
				field.Append(toTime(val))
			case data.FieldTypeFloat64:
				field.Append(toFloat64(val))
			case data.FieldTypeBool:
				field.Append(toBool(val))
			default:
				field.Append(fmt.Sprintf("%v", val))
			}
		}

		frame.Fields = append(frame.Fields, field)
	}

	d.logger.Printf("[QueryData] %d rows, %d columns returned", len(thrukResp.Data), len(columns))

	visType := qm.Type
	if visType == "timeseries" {
		visType = "graph"
	}
	frame.Meta = &data.FrameMeta{
		PreferredVisualization: data.VisType(visType),
	}

	return backend.DataResponse{Frames: data.Frames{frame}}
}

func (d *Datasource) setAuth(req *http.Request) {
	if d.basicAuth != "" {
		req.Header.Set("Authorization", d.basicAuth)
	}
}

func (d *Datasource) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	d.logger.Printf("[Resource] %s %s", req.Path, req.URL)

	var thrukPath string
	var extraHeaders map[string]string

	switch req.Path {
	case "tables":
		thrukPath = "/r/v1/index?columns=url&protocol=get"
	case "columns":
		table := getQueryParam(req.URL, "table")
		if table == "" {
			d.logger.Printf("[Resource] missing table parameter")
			return sender.Send(&backend.CallResourceResponse{
				Status: http.StatusBadRequest,
				Body:   []byte("missing 'table' query parameter"),
			})
		}
		table = strings.TrimPrefix(table, "/")
		thrukPath = "/r/v1/" + table + "?limit=1"
		extraHeaders = map[string]string{"x-thruk-columns": "true"}
	default:
		thrukPath = "/r/v1/" + strings.TrimPrefix(req.Path, "/")
	}

	thrukURL := d.url + thrukPath
	d.logger.Printf("[Resource] GET %s", thrukURL)

	httpReq, err := http.NewRequestWithContext(ctx, "GET", thrukURL, nil)
	if err != nil {
		d.logger.Printf("[Resource] failed to create request: %v", err)
		return sender.Send(&backend.CallResourceResponse{
			Status: http.StatusInternalServerError,
			Body:   []byte(fmt.Sprintf("failed to create request: %v", err)),
		})
	}
	d.setAuth(httpReq)
	for k, v := range extraHeaders {
		httpReq.Header.Set(k, v)
	}

	start := time.Now()
	resp, err := d.httpClient.Do(httpReq)
	elapsed := time.Since(start)
	if err != nil {
		d.logger.Printf("[Resource] request failed after %v: %v", elapsed, err)
		return sender.Send(&backend.CallResourceResponse{
			Status: http.StatusInternalServerError,
			Body:   []byte(fmt.Sprintf("request failed: %v", err)),
		})
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		d.logger.Printf("[Resource] failed to read response: %v", err)
		return sender.Send(&backend.CallResourceResponse{
			Status: http.StatusInternalServerError,
			Body:   []byte(fmt.Sprintf("failed to read response: %v", err)),
		})
	}

	d.logger.Printf("[Resource] response %d (%v, %d bytes)", resp.StatusCode, elapsed, len(body))

	return sender.Send(&backend.CallResourceResponse{
		Status: resp.StatusCode,
		Body:   body,
	})
}
