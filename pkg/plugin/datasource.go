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
	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
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

// What a query coming in from Grafana will contain
// Defined in types.ts as ThrukQuery
type queryModel struct {
	Table     string   `json:"table"`
	Columns   []string `json:"columns"`
	Condition string   `json:"condition"`
	Limit     int      `json:"limit"`
	// can be a string
	// can be a object {"label": "Timeseries","value": "graph"}
	Type any `json:"type"`
}

// This type saves elements of "meta"."columns" array in wrapped_json type of Thruk responses
// Most of the colum metadata only have "name"
// Some might have "type" as well, taking values like: "time"
// Some might have "config" which is a nested object like: { "unit" : "s"},
// GrafanaDataType: added later, not present in Thruk Response
type columnMetadata struct {
	Name            string         `json:"name"`
	Type            string         `json:"type"`
	GrafanaDataType data.FieldType `json:"grafanaDataType"`
	Config          any            `json:"config"`
}

// This type saves "meta" object in wrapped_json type of Thruk response
// RequestDuration: is added later, not present in Thruk Response
// ParseDuration: is added later, not present in Thruk response
type thrukMetadata struct {
	Columns         []columnMetadata `json:"columns"`
	RequestDuration time.Duration    `json:"requestDuration"`
	ParseDuration   time.Duration    `json:"parseDuration"`
}

// This type saves a wrapped_json type of Thruk response
// { "data": [] , "meta": []}
// docs/r-v1-hosts-response.json has an example of this
type thrukResponse struct {
	Data []map[string]any `json:"data"`
	Meta *thrukMetadata   `json:"meta"`
}

type Datasource struct {
	url        string
	httpClient *http.Client
	logger     *log.Logger
	logFile    *os.File
	uid        string
}

// ConfigEditor.tsx props has options
// options has a jsonData field of type DataSourceSettings<T, S>
// options.jsonData is of type T
// in Config.Editor.tsx it uses ThrukDataSourceOptions as T
// Configuration of a datasource is then sent as backend.DataSourceInstanceSettings
// backend.DataSourceInstanceSettings.jsonData is of type json.RawMessage
// parse it into this type, which reflects ThrukDataSourceOptions
// ThrukDataSourceOptions in turn extends upon a default field configuration
type DatasourceSettingsJSONData struct {
	KeepCookies     []string `json:"keepCookies"`
	LogLevel        int64    `json:"logLevel"`
	LogPath         string   `json:"logPath"`
	PdcInjected     *bool    `json:"pdcInjected,omitempty"`
	ServerName      *string  `json:"serverName,omitempty"`
	TlsAuth         *bool    `json:"tlsAuth,omitempty"`
	TlsSkipVerify   *bool    `json:"tlsSkipVerify,omitempty"`
	ReadOnly        *bool    `json:"readOnly,omitempty"`
	HTTPHeaderName1 *string  `json:"httpHeaderName1,omitempty"`
	HTTPHeaderName2 *string  `json:"httpHeaderName2,omitempty"`
	HTTPHeaderName3 *string  `json:"httpHeaderName3,omitempty"`
	HTTPHeaderName4 *string  `json:"httpHeaderName4,omitempty"`
	HTTPHeaderName5 *string  `json:"httpHeaderName5,omitempty"`
}

type DatasourceSettingsSecureJSONData struct {
	HTTPHeaderValue1 *string `json:"httpHeaderValue1,omitempty"`
	HTTPHeaderValue2 *string `json:"httpHeaderValue2,omitempty"`
	HTTPHeaderValue3 *string `json:"httpHeaderValue3,omitempty"`
	HTTPHeaderValue4 *string `json:"httpHeaderValue4,omitempty"`
	HTTPHeaderValue5 *string `json:"httpHeaderValue5,omitempty"`
	TlsClientCert    *string `json:"tlsClientCert,omitempty"`
	TlsClientKey     *string `json:"tlsClientKey,omitempty"`
}

// This function is to be implemented accoring to the SDK interface
func NewDatasource(ctx context.Context, settings backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
	u := strings.TrimRight(settings.URL, "/")

	var jsonData DatasourceSettingsJSONData
	if settings.JSONData != nil {
		if err := json.Unmarshal(settings.JSONData, &jsonData); err != nil {
			return nil, fmt.Errorf("failed to parse jsonData: %w", err)
		}
	}
	jsonData.setDefaults()

	logger, logFile := createLogger(&jsonData)
	logger.Printf("[NewDatasource] setttings:\n%s", StringDataSourceInstanceSettings(&settings))

	httpOpts, err := settings.HTTPClientOptions(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get http client options from context: %w", err)
	}

	httpOpts.ForwardHTTPHeaders = true
	httpOpts.Timeouts = &httpclient.TimeoutOptions{
		Timeout: 30 * time.Second,
	}

	httpOpts.TLS = &httpclient.TLSOptions{
		InsecureSkipVerify: *jsonData.TlsSkipVerify,
	}

	logger.Printf("[NewDatasource] http client options: %s", HTTPClientOptionsToString(httpOpts))

	provider := httpclient.NewProvider()
	client, err := provider.New(httpOpts)
	if err != nil {
		return nil, fmt.Errorf("couldnt create http client using provider: %w", err)
	}

	logger.Printf("[NewDatasource] creating new datasource with uid: %s", settings.UID)

	return &Datasource{
		url:        u,
		httpClient: client,
		logger:     logger,
		logFile:    logFile,
		uid:        settings.UID,
	}, nil
}

// This function is to be implemented accoring to the SDK interface
func (d *Datasource) Dispose() {
	if d.logger != nil {
		d.logger.Println("Plugin instance disposed")
	}
	if d.logFile != nil {
		d.logFile.Close()
	}
}

// This function is to be implemented accoring to the SDK interface
func (d *Datasource) CheckHealth(ctx context.Context, _ *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	d.logger.Println("[CheckHealth] testing connection")

	thrukURL := d.url + "/r/v1/thruk?columns=thruk_version"
	d.logger.Printf("[datasource: %s] [CheckHealth] GET %s\n", d.uid, thrukURL)

	req, err := http.NewRequestWithContext(ctx, "GET", thrukURL, nil)
	if err != nil {
		d.logger.Printf("[CheckHealth] failed to create request: %v", err)
		return &backend.CheckHealthResult{
			Status:  backend.HealthStatusError,
			Message: fmt.Sprintf("Failed to create request: %v", err),
		}, nil
	}
	d.logger.Printf("[datasource: %s] [CheckHealth] Cookie Header: %s", d.uid, req.Header.Values("Cookie"))

	start := time.Now()
	resp, err := d.httpClient.Do(req)
	elapsed := time.Since(start)
	if err != nil {
		d.logger.Printf("[datasource: %s] [CheckHealth] connection failed after %v: %v", d.uid, elapsed, err)
		return &backend.CheckHealthResult{
			Status:  backend.HealthStatusError,
			Message: fmt.Sprintf("Connection failed: %v", err),
		}, nil
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)

	var CheckHealthResponseType struct {
		ThrukVersion string `json:"thruk_version"`
	}

	d.logger.Printf("[datasource: %s] [CheckHealth] response code: %d , elapsed: %v", d.uid, resp.StatusCode, elapsed)
	d.logger.Printf("[datasource: %s] [CheckHealth] response body: %s", d.uid, string(body))

	if resp.StatusCode != http.StatusOK {
		return &backend.CheckHealthResult{
			Status:  backend.HealthStatusError,
			Message: fmt.Sprintf("Unexpected status %d", resp.StatusCode),
		}, nil
	}

	if err := json.Unmarshal(body, &CheckHealthResponseType); err != nil {
		d.logger.Printf("[CheckHealth] failed to parse response: %v", err)
		return &backend.CheckHealthResult{
			Status:  backend.HealthStatusError,
			Message: fmt.Sprintf("Failed to parse response: %v", err),
		}, nil
	}

	if CheckHealthResponseType.ThrukVersion == "" {
		d.logger.Println("[CheckHealth] no thruk_version in response")
		return &backend.CheckHealthResult{
			Status:  backend.HealthStatusError,
			Message: "Invalid URL, did not find Thruk version in response",
		}, nil
	}

	d.logger.Printf("[CheckHealth] connected to Thruk v%s", CheckHealthResponseType.ThrukVersion)
	return &backend.CheckHealthResult{
		Status:  backend.HealthStatusOk,
		Message: "Successfully connected to Thruk v" + CheckHealthResponseType.ThrukVersion,
	}, nil
}

// This function is to be implemented accoring to the SDK interface
func (d *Datasource) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	d.logger.Printf("[datasource: %s] [QueryData] received %d queries", d.uid, len(req.Queries))

	response := backend.NewQueryDataResponse()
	for _, q := range req.Queries {
		res := d.query(ctx, q)
		response.Responses[q.RefID] = res
	}

	//responseJSON, _ := response.DeepCopy().MarshalJSON()
	//d.logger.Printf("[QueryData] response:\n%v", string(responseJSON))

	return response, nil
}

func (d *Datasource) query(ctx context.Context, query backend.DataQuery) backend.DataResponse {
	var qm queryModel
	if err := json.Unmarshal(query.JSON, &qm); err != nil {
		d.logger.Printf("[QueryData] refId=%s unmarshal error: %v", query.RefID, err)
		return backend.ErrDataResponse(backend.StatusBadRequest, fmt.Sprintf("json unmarshal: %v", err.Error()))
	}

	d.logger.Printf("[QueryData] refId=%s table=%s columns=%v condition=%q limit=%d type=%v",
		query.RefID, qm.Table, qm.Columns, qm.Condition, qm.Limit, qm.Type)

	rewriteAliasedEndpoints(&qm)

	d.logger.Printf("[QueryData] rewritten refId=%s table=%s columns=%v condition=%q limit=%d type=%v",
		query.RefID, qm.Table, qm.Columns, qm.Condition, qm.Limit, qm.Type)

	thrukURL := d.buildQueryURL(qm)
	d.logger.Printf("[HTTP] GET %s", thrukURL)

	cachedResult, err := getCachedResult(&qm, d.uid, thrukURL, nil)
	if err != nil {
		d.logger.Printf("[CACHE] error when getting cached result: %s", err.Error())
	}
	if cachedResult != nil {
		d.logger.Printf("[CACHE] using cached result for query %s", thrukURL)
		return *cachedResult.result
	}

	req, err := http.NewRequestWithContext(ctx, "GET", thrukURL, nil)
	if err != nil {
		d.logger.Printf("[HTTP] failed to create request: %v", err)
		return backend.ErrDataResponse(backend.StatusBadRequest, fmt.Sprintf("failed to create request: %v", err))
	}
	req.Header.Set("X-THRUK-OutputFormat", "wrapped_json")

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

	d.logger.Printf("[HTTP] response code: %d %s , elapsed: %v , bytes: %d", resp.StatusCode, resp.Status, elapsed, len(body))

	if resp.StatusCode != http.StatusOK {
		return backend.ErrDataResponse(backend.StatusBadRequest, fmt.Sprintf("thruk returned status: %d , body: %s", resp.StatusCode, string(body)))
	}

	parseStart := time.Now()
	result := d.parseThrukResponse(body, qm, query.TimeRange)
	d.logger.Printf("[QueryData] refId=%s parsed in %v", query.RefID, time.Since(parseStart))

	err = writeCachedResult(&qm, d.uid, thrukURL, nil, &result)
	if err != nil {
		d.logger.Printf("[CACHE] error when writing cached result: %s", err.Error())
	}

	return result
}

func (d *Datasource) buildQueryURL(qm queryModel) string {
	rewriteAliasedEndpoints(&qm)

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

// intended to parse thruk reponses in wrapped_json format
// The "data" field of the json can either be an array of objects or simply an object
// Take a look under /docs/call-r-v1-hosts.sh for an array response.
// Take a look under /docs/call-r-v1-services-totals.sh for an object example
func (d *Datasource) parseThrukResponse(body []byte, qm queryModel, timeRange backend.TimeRange) backend.DataResponse {
	var thrukResp thrukResponse

	// Try wrapped_json format: { "data": <array|object> , "meta": {...} }
	var rawResp struct {
		Data json.RawMessage `json:"data"`
		Meta *thrukMetadata  `json:"meta"`
	}
	if err := json.Unmarshal(body, &rawResp); err == nil && rawResp.Data != nil {
		thrukResp.Meta = rawResp.Meta
		// Try data as array first, then as single object
		if err := json.Unmarshal(rawResp.Data, &thrukResp.Data); err != nil {
			var dataObj map[string]any
			if err2 := json.Unmarshal(rawResp.Data, &dataObj); err2 == nil {
				thrukResp.Data = []map[string]any{dataObj}
			}
		}
	} else {
		// Not wrapped_json - try plain array, then single object
		var plainData []map[string]any
		if err := json.Unmarshal(body, &plainData); err == nil {
			thrukResp.Data = plainData
		} else {
			var singleObj map[string]any
			if err := json.Unmarshal(body, &singleObj); err != nil {
				d.logger.Printf("[QueryData] failed to parse response: %v", err)
				return backend.ErrDataResponse(backend.StatusBadRequest, fmt.Sprintf("failed to parse response: %v", err))
			}
			thrukResp.Data = []map[string]any{singleObj}
		}
	}

	if len(thrukResp.Data) == 0 {
		d.logger.Printf("[QueryData] empty response, 0 rows returned")
		return backend.DataResponse{Frames: data.Frames{data.NewFrame("response")}}
	}

	visType := parseVisType(qm.Type)

	if visType == "graph" {
		return d.buildTimeseriesFrames(&thrukResp, timeRange, qm)
	}

	return d.buildTableFrame(&qm, &thrukResp, visType)
}

// This function assumes that thrukResponse.Data is of type []map[string]any
// Even when the response was a single object, it is converted in parseThrukResponse method
func (d *Datasource) buildTableFrame(qm *queryModel, thrukResp *thrukResponse, visType string) backend.DataResponse {
	// add known query types from query model and columns
	addKnownGrafanaDataTypes(qm, thrukResp.Meta)

	metaColumns := buildMetaColumnMap(thrukResp)
	columns := determineColumns(thrukResp)

	frame := data.NewFrame("response")
	for _, col := range columns {

		unknownFieldType := false
		fieldType, metadataWritenType := inferFieldType(col, metaColumns)
		if fieldType == data.FieldTypeUnknown {
			unknownFieldType = true
			fieldType = data.FieldTypeString
		}

		field := data.NewFieldFromFieldType(fieldType, 0)
		field.Name = col

		d.logger.Printf("[TableFrame] building column: %s , fieldType is unknown: %t , final fieldType: %s", col, unknownFieldType, FieldTypeToString(fieldType))

		for _, row := range thrukResp.Data {
			val := row[col]
			// d.logger.Printf("[TableFrame] [Column: %s] val: %v", col, val)

			if unknownFieldType {
				field.Append(toString(val))
				field.Config = &data.FieldConfig{
					Description: "string",
					Color:       map[string]any{"mode": "fixed", "fixedColor": "white"},
					Custom:      map[string]any{"cellOptions": map[string]any{"type": "color-background"}},
				}
				continue
			}

			switch fieldType {
			case data.FieldTypeInt64:
				field.Append(toInt64(val))
				field.Config = &data.FieldConfig{
					Description: "int64",
					Color:       map[string]any{"mode": "fixed", "fixedColor": "blue"},
					Custom:      map[string]any{"cellOptions": map[string]any{"type": "color-background"}},
				}
			case data.FieldTypeFloat64:
				field.Append(toFloat64(val))
				field.Config = &data.FieldConfig{
					Description: "float64",
					Color:       map[string]any{"mode": "fixed", "fixedColor": "silver"},
					Custom:      map[string]any{"cellOptions": map[string]any{"type": "color-background"}},
				}
			case data.FieldTypeTime:
				field.Append(toTime(val))
				field.Config = &data.FieldConfig{
					Description: "time",
					Color:       map[string]any{"mode": "fixed", "fixedColor": "green"},
					Custom:      map[string]any{"cellOptions": map[string]any{"type": "color-background"}},
				}
			case data.FieldTypeBool:
				field.Append(toBool(val))
				field.Config = &data.FieldConfig{
					Description: "bool",
					Custom:      map[string]any{"cellOptions": map[string]any{"mode": "thresholds", "type": "color-background"}},
					Color: map[string]any{
						"0":     "white",
						"1":     "white",
						"true":  "white",
						"false": "white",
					},
					Thresholds: &data.ThresholdsConfig{
						Mode: data.ThresholdsModeAbsolute,
						Steps: []data.Threshold{
							{Value: 0, Color: "white"},
							{Value: 1, Color: "white"},
							{Value: 0.0, Color: "white"},
							{Value: 1.0, Color: "white"},
						},
					},
				}
			case data.FieldTypeString:
				switch metadataWritenType {
				case "array_of_strings":
					val2 := []string{}
					if valAsAnyArray, ok := val.([]any); ok {
						for _, elem := range valAsAnyArray {
							val2 = append(val2, toString(elem))
						}
					}
					field.Append(toString(val2))
					field.Config = &data.FieldConfig{
						Description: "string",
						Color:       map[string]any{"mode": "fixed", "fixedColor": "fuchsia"},
						Custom:      map[string]any{"cellOptions": map[string]any{"type": "color-background"}},
					}
				default:
					field.Append(toString(val))
					field.Config = &data.FieldConfig{
						Description: "string",
						Color:       map[string]any{"mode": "fixed", "fixedColor": "purple"},
						Custom:      map[string]any{"cellOptions": map[string]any{"type": "color-background"}},
					}
				}

			default:
				field.Append(toString(val))
				field.Config = &data.FieldConfig{
					Description: "string",
					Color:       map[string]any{"mode": "fixed", "fixedColor": "black"},
					Custom:      map[string]any{"cellOptions": map[string]any{"type": "color-background"}},
				}
			}
		}

		frame.Fields = append(frame.Fields, field)
	}

	d.logger.Printf("[QueryData] table: %d rows, %d columns", len(thrukResp.Data), len(columns))
	frame.Meta = &data.FrameMeta{PreferredVisualization: data.VisType(visType)}
	return backend.DataResponse{Frames: data.Frames{frame}}
}

// buildTimeseriesFrames converts tabular Thruk data into Grafana time series frames.
// This is the Go equivalent of the frontend's _fakeTimeseries() method.
// Each data row becomes its own frame. Columns with aggregation functions (e.g. "count()")
// or numeric values become the value column; remaining columns form the series alias.
// The value is spread across 10 evenly-spaced time points covering the query's time range.
func (d *Datasource) buildTimeseriesFrames(thrukResp *thrukResponse, timeRange backend.TimeRange, qm queryModel) backend.DataResponse {
	const steps = 10
	from := timeRange.From.Unix()
	to := timeRange.To.Unix()
	step := (to - from) / steps
	if step <= 0 {
		step = 1
	}

	metaColumns := buildMetaColumnMap(thrukResp)
	columns := determineColumns(thrukResp)

	// Use user-specified columns if provided, otherwise use all response columns
	orderedColumns := columns
	if len(qm.Columns) > 0 && !(len(qm.Columns) == 1 && qm.Columns[0] == "*") {
		orderedColumns = qm.Columns
	}

	dataRows := thrukResp.Data

	// Convert single-row with many columns into key-value pairs, same as frontend
	if len(dataRows) == 1 && len(orderedColumns) > 2 {
		converted := make([]map[string]any, 0, len(orderedColumns))
		for _, key := range orderedColumns {
			converted = append(converted, map[string]any{
				"__key":   key,
				"__value": dataRows[0][key],
			})
		}
		dataRows = converted
		orderedColumns = []string{"__key", "__value"}
		// Override meta types for the converted columns
		metaColumns["__key"] = columnMetadata{Name: "__key"}
		metaColumns["__value"] = columnMetadata{Name: "__value",
			GrafanaDataType: data.FieldTypeFloat64}
	}

	// Find value column: first aggregation column, or first numeric, or first available
	valueCol := findValueColumn(orderedColumns, metaColumns, dataRows)

	// Name columns are all remaining columns not used as value
	var nameCols []string
	for _, col := range orderedColumns {
		if col != valueCol {
			nameCols = append(nameCols, col)
		}
	}

	var frames data.Frames
	d.logger.Printf("[QueryData] timeseries: %d rows, valueCol=%s, nameCols=%v", len(dataRows), valueCol, nameCols)

	for _, row := range dataRows {
		val := row[valueCol]
		alias := valueCol
		if len(nameCols) > 0 {
			parts := make([]string, 0, len(nameCols))
			for _, nc := range nameCols {
				parts = append(parts, fmt.Sprintf("%v", row[nc]))
			}
			alias = strings.Join(parts, ";")
		}

		frame := data.NewFrame(alias)
		frame.Fields = append(frame.Fields,
			data.NewField("time", nil, make([]time.Time, steps)),
			data.NewField(alias, nil, make([]float64, steps)),
		)

		for i := 0; i < steps; i++ {
			frame.Set(0, i, time.Unix(from+step*int64(i), 0).UTC())
			frame.Set(1, i, toFloat64(val))
		}

		frame.Meta = &data.FrameMeta{
			PreferredVisualization: data.VisTypeGraph,
		}
		frames = append(frames, frame)
	}

	return backend.DataResponse{Frames: frames}
}

func findValueColumn(columns []string, metaColumns map[string]columnMetadata, dataRows []map[string]any) string {
	if len(columns) == 0 {
		return ""
	}

	// First preference: column using aggregation function e.g. "count()"
	for _, col := range columns {
		if strings.Contains(col, "(") && strings.Contains(col, ")") {
			return col
		}
	}

	// Second preference: first numeric column
	if len(dataRows) > 0 {
		for _, col := range columns {
			if mc, ok := metaColumns[col]; ok {
				if mc.GrafanaDataType != data.FieldTypeUnknown {
					if mc.GrafanaDataType == data.FieldTypeFloat64 || mc.GrafanaDataType == data.FieldTypeInt64 {
						return col
					}
				}
				if mc.Type == "number" {
					return col
				}
			}
			// Fallback: check the actual value
			if _, isNum := dataRows[0][col].(float64); isNum {
				return col
			}
			if _, isNum := dataRows[0][col].(json.Number); isNum {
				return col
			}
		}
	}

	// Third preference: first available column
	return columns[0]
}

func (d *Datasource) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	d.logger.Printf("[Resource] path: %s url: %s", req.Path, req.URL)

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
	case "variable-query":
		table := getQueryParam(req.URL, "table")
		q := getQueryParam(req.URL, "q")
		columns := getQueryParam(req.URL, "columns")
		limit := getQueryParam(req.URL, "limit")
		if table == "" {
			d.logger.Printf("[Resource] variable-query missing table parameter")
			return sender.Send(&backend.CallResourceResponse{
				Status: http.StatusBadRequest,
				Body:   []byte("missing 'table' query parameter"),
			})
		}
		table = strings.TrimPrefix(table, "/")
		thrukPath = "/r/v1/" + table + "?columns=" + url.QueryEscape(columns) +
			"&q=" + url.QueryEscape(q) +
			"&limit=" + url.QueryEscape(limit)
		extraHeaders = map[string]string{"X-Thruk-Output-Metadata-Only": "true"}
	default:
		thrukPath = "/r/v1/" + strings.TrimPrefix(req.Path, "/")
	}

	thrukURL := d.url + thrukPath
	d.logger.Printf("[Resource] GET thrukUrl: %s", thrukURL)

	httpReq, err := http.NewRequestWithContext(ctx, "GET", thrukURL, nil)
	if err != nil {
		d.logger.Printf("[Resource] failed to create request: %v", err)
		return sender.Send(&backend.CallResourceResponse{
			Status: http.StatusInternalServerError,
			Body:   []byte(fmt.Sprintf("failed to create request: %v", err)),
		})
	}

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
