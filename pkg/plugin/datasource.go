package plugin

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
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
}

func NewDatasource(_ context.Context, settings backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
	u := strings.TrimRight(settings.URL, "/")
	return &Datasource{
		url:       u,
		basicAuth: buildBasicAuth(settings),
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}, nil
}

func buildBasicAuth(s backend.DataSourceInstanceSettings) string {
	if s.BasicAuthEnabled && s.BasicAuthUser != "" {
		password := s.DecryptedSecureJSONData["basicAuthPassword"]
		auth := s.BasicAuthUser + ":" + password
		return "Basic " + base64.StdEncoding.EncodeToString([]byte(auth))
	}
	return ""
}

func (d *Datasource) Dispose() {}

func (d *Datasource) CheckHealth(ctx context.Context, _ *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	thrukURL := d.url + "/r/v1/thruk?columns=thruk_version"
	req, err := http.NewRequestWithContext(ctx, "GET", thrukURL, nil)
	if err != nil {
		return &backend.CheckHealthResult{
			Status:  backend.HealthStatusError,
			Message: fmt.Sprintf("Failed to create request: %v", err),
		}, nil
	}
	d.setAuth(req)

	resp, err := d.httpClient.Do(req)
	if err != nil {
		return &backend.CheckHealthResult{
			Status:  backend.HealthStatusError,
			Message: fmt.Sprintf("Connection failed: %v", err),
		}, nil
	}
	defer resp.Body.Close()

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
		return &backend.CheckHealthResult{
			Status:  backend.HealthStatusError,
			Message: fmt.Sprintf("Failed to parse response: %v", err),
		}, nil
	}
	if result.ThrukVersion == "" {
		return &backend.CheckHealthResult{
			Status:  backend.HealthStatusError,
			Message: "Invalid URL, did not find Thruk version in response",
		}, nil
	}

	return &backend.CheckHealthResult{
		Status:  backend.HealthStatusOk,
		Message: "Successfully connected to Thruk v" + result.ThrukVersion,
	}, nil
}

func (d *Datasource) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
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
		return backend.ErrDataResponse(backend.StatusBadRequest, fmt.Sprintf("json unmarshal: %v", err.Error()))
	}

	thrukURL := d.buildQueryURL(qm)
	req, err := http.NewRequestWithContext(ctx, "GET", thrukURL, nil)
	if err != nil {
		return backend.ErrDataResponse(backend.StatusBadRequest, fmt.Sprintf("failed to create request: %v", err))
	}
	req.Header.Set("X-THRUK-OutputFormat", "wrapped_json")
	d.setAuth(req)

	resp, err := d.httpClient.Do(req)
	if err != nil {
		return backend.ErrDataResponse(backend.StatusBadRequest, fmt.Sprintf("request failed: %v", err))
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return backend.ErrDataResponse(backend.StatusBadRequest, fmt.Sprintf("failed to read response: %v", err))
	}

	if resp.StatusCode != http.StatusOK {
		return backend.ErrDataResponse(backend.StatusBadRequest, fmt.Sprintf("thruk returned status %d", resp.StatusCode))
	}

	return d.parseThrukResponse(body, qm)
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
				return backend.ErrDataResponse(backend.StatusBadRequest, fmt.Sprintf("failed to parse response: %v", err))
			}
			thrukResp.Data = []map[string]interface{}{singleObj}
		} else {
			thrukResp.Data = plainData
		}
	}

	frame := data.NewFrame("response")

	if len(thrukResp.Data) == 0 {
		return backend.DataResponse{Frames: data.Frames{frame}}
	}

	columns := d.determineColumns(&thrukResp)
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

	visType := qm.Type
	if visType == "timeseries" {
		visType = "graph"
	}
	frame.Meta = &data.FrameMeta{
		PreferredVisualization: data.VisType(visType),
	}

	return backend.DataResponse{Frames: data.Frames{frame}}
}

func (d *Datasource) determineColumns(resp *thrukResponse) []string {
	if resp.Meta != nil && len(resp.Meta.Columns) > 0 {
		cols := make([]string, 0, len(resp.Meta.Columns))
		for _, c := range resp.Meta.Columns {
			cols = append(cols, c.Name)
		}
		return cols
	}
	if len(resp.Data) > 0 {
		cols := make([]string, 0, len(resp.Data[0]))
		for key := range resp.Data[0] {
			cols = append(cols, key)
		}
		return cols
	}
	return nil
}

func buildMetaColumnMap(resp *thrukResponse) map[string]metaColumn {
	m := make(map[string]metaColumn)
	if resp.Meta != nil {
		for _, c := range resp.Meta.Columns {
			m[c.Name] = c
		}
	}
	return m
}

func inferFieldType(name string, metaColumns map[string]metaColumn) data.FieldType {
	if mc, ok := metaColumns[name]; ok {
		switch mc.Type {
		case "number":
			return data.FieldTypeFloat64
		case "time":
			return data.FieldTypeTime
		case "bool", "boolean":
			return data.FieldTypeBool
		}
	}
	if strings.HasPrefix(name, "last_") || strings.HasPrefix(name, "next_") ||
		strings.HasPrefix(name, "start_") || strings.HasPrefix(name, "end_") ||
		strings.HasPrefix(name, "time") {
		return data.FieldTypeTime
	}
	if strings.HasPrefix(name, "time_") {
		return data.FieldTypeFloat64
	}
	return data.FieldTypeString
}

func toTime(v interface{}) time.Time {
	switch val := v.(type) {
	case float64:
		return time.Unix(int64(val), 0)
	case json.Number:
		i, err := val.Int64()
		if err == nil {
			return time.Unix(i, 0)
		}
	}
	return time.Time{}
}

func toFloat64(v interface{}) float64 {
	switch val := v.(type) {
	case float64:
		return val
	case json.Number:
		f, err := val.Float64()
		if err == nil {
			return f
		}
	}
	return 0
}

func toBool(v interface{}) bool {
	switch val := v.(type) {
	case bool:
		return val
	case string:
		b, err := strconv.ParseBool(val)
		if err == nil {
			return b
		}
	}
	return false
}

func getQueryParam(rawURL string, key string) string {
	u, err := url.Parse(rawURL)
	if err != nil {
		return ""
	}
	return u.Query().Get(key)
}

func (d *Datasource) setAuth(req *http.Request) {
	if d.basicAuth != "" {
		req.Header.Set("Authorization", d.basicAuth)
	}
}

func (d *Datasource) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	var thrukPath string
	var extraHeaders map[string]string

	switch req.Path {
	case "tables":
		thrukPath = "/r/v1/index?columns=url&protocol=get"
	case "columns":
		table := getQueryParam(req.URL, "table")
		if table == "" {
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
	httpReq, err := http.NewRequestWithContext(ctx, "GET", thrukURL, nil)
	if err != nil {
		return sender.Send(&backend.CallResourceResponse{
			Status: http.StatusInternalServerError,
			Body:   []byte(fmt.Sprintf("failed to create request: %v", err)),
		})
	}
	d.setAuth(httpReq)
	for k, v := range extraHeaders {
		httpReq.Header.Set(k, v)
	}

	resp, err := d.httpClient.Do(httpReq)
	if err != nil {
		return sender.Send(&backend.CallResourceResponse{
			Status: http.StatusInternalServerError,
			Body:   []byte(fmt.Sprintf("request failed: %v", err)),
		})
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return sender.Send(&backend.CallResourceResponse{
			Status: http.StatusInternalServerError,
			Body:   []byte(fmt.Sprintf("failed to read response: %v", err)),
		})
	}

	return sender.Send(&backend.CallResourceResponse{
		Status: resp.StatusCode,
		Body:   body,
	})
}
