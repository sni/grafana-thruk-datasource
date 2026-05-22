package plugin

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"net/url"
	"os"
	"path/filepath"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
)

func getQueryParam(rawURL string, key string) string {
	u, err := url.Parse(rawURL)
	if err != nil {
		return ""
	}
	return u.Query().Get(key)
}

func buildBasicAuthenticationHeader(s backend.DataSourceInstanceSettings) string {
	if s.BasicAuthEnabled && s.BasicAuthUser != "" {
		password := s.DecryptedSecureJSONData["basicAuthPassword"]
		auth := s.BasicAuthUser + ":" + password
		return "Basic " + base64.StdEncoding.EncodeToString([]byte(auth))
	}
	return ""
}

// works on wrapped_json calls where metadata is present, or normal calls where everything is on the same object
// docs/r-v1-hosts-response.json and docs/r1-v1-thruk-response.json
func determineColumns(resp *thrukResponse) []string {
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

func buildMetaColumnMap(resp *thrukResponse) map[string]columnMetadata {
	m := make(map[string]columnMetadata)
	if resp.Meta != nil {
		for _, c := range resp.Meta.Columns {
			m[c.Name] = c
		}
	}
	return m
}

func createLogger(jsonData *DatasourceSettingsJSONData) (*log.Logger, *os.File) {
	// If logLevel is 0 or jsonData is nil, don't create a logger
	if jsonData == nil || jsonData.LogLevel == 0 {
		return log.New(os.Stderr, "[grafana-thruk-datasource] ", log.LstdFlags), nil
	}

	logPath := jsonData.LogPath
	if logPath == "" {
		logPath = "logs/plugin.log"
	}

	// Expand environment variables and ~ in the path
	expandedPath := os.ExpandEnv(logPath)
	expandedPath = os.Expand(expandedPath, func(key string) string {
		// Handle ~ expansion manually
		if key == "~" {
			home, _ := os.UserHomeDir()
			return home
		}
		// Let os.ExpandEnv handle other env vars
		return ""
	})

	// Create directories if they don't exist
	dir := filepath.Dir(expandedPath)
	if dir != "." {
		os.MkdirAll(dir, 0755)
	}

	filename := expandedPath
	f, err := os.OpenFile(filename, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return log.New(os.Stderr, "[grafana-thruk-datasource] ", log.LstdFlags), nil
	}

	return log.New(f, "", log.LstdFlags), f
}

// if we know the table used in query model, we can iterate through the columns and add their backend types by hand
// this is a band-aid fix. it would be better if thruk reported everything correctly in its metada
// sometimes it does not add types to stuff like num_services , leading them to be parsed as strings
// that is our fallback defaut type
func addKnownGrafanaDataTypes(qm *queryModel, meta *thrukMetadata) {

	findAndChangeType := func(meta *thrukMetadata, name string, t data.FieldType) {
		for i := range meta.Columns {
			if meta.Columns[i].Name == name {
				meta.Columns[i].GrafanaDataType = t
			}
		}
	}

	switch qm.Table {
	case "/services/totals":
		findAndChangeType(meta, "ok", data.FieldTypeInt64)
		findAndChangeType(meta, "warning", data.FieldTypeInt64)
		findAndChangeType(meta, "unknown", data.FieldTypeInt64)
		findAndChangeType(meta, "critical", data.FieldTypeInt64)
	}
}

func (jsonData *DatasourceSettingsJSONData) setDefaults() {
	if jsonData.PdcInjected == nil {
		val := true
		jsonData.PdcInjected = &val
	}

	if jsonData.TlsAuth == nil {
		val := true
		jsonData.TlsAuth = &val
	}

	if jsonData.TlsSkipVerify == nil {
		val := false
		jsonData.TlsSkipVerify = &val
	}
}

// There are two ways for using cookies through backend
// 1. Manually specify them using Header with name 'Cookie' and value '<cookie_name>=<cookie_value>'
// These are transmitted using jsonData.httpHeaderNameN and secureJsonData.httpHeaderValueN
// The code parses up to 5 of these
// 2. Specify which cookies to forward from Grafana
// Grafana should access these cookies, while Thruk sets them. thruk_auth cookie looks something like this:
// { "name": "thruk_auth", "value": "788599f61eb529b18a6a93f520b37c235a1e84e5bf26bfa0cca3cbebb4c06363_1", "domain": "192.168.202.202:3000", "hostOnly": true, "path": "/", "secure": false, "httpOnly": true, "sameSite": "lax", "session": true, "firstPartyDomain": "", "partitionKey": null, "storeId": null }
// Which cookies are forwarded is specified in jsonData.KeepCookies
// Cookies forwarded are put into the Request Headers like this:
// Cookie thruk_auth=788599f61eb529b18a6a93f520b37c235a1e84e5bf26bfa0cca3cbebb4c06363_1; thruk_screen={"height":1010,"width":2421}
func buildCookieJar(jsonData *DatasourceSettingsJSONData, secureJSONData *DatasourceSettingsSecureJSONData) {

}

// String returns a string representation of the DataSourceInstanceSettings.
func StringDataSourceInstanceSettings(s *backend.DataSourceInstanceSettings) string {
	var jsonDataBytes []byte
	jsonDataStr := "nil"
	if s.JSONData != nil {
		jsonDataBytes = []byte(s.JSONData)
		// Pretty-print the JSON
		var prettyJSON bytes.Buffer
		if err := json.Indent(&prettyJSON, jsonDataBytes, "", "  "); err == nil {
			jsonDataStr = "\n" + prettyJSON.String()
		} else {
			jsonDataStr = "\n" + string(jsonDataBytes)
		}
	}

	var decryptedDataStr string
	if s.DecryptedSecureJSONData != nil {
		// Pretty-print the map as JSON
		decryptedBytes, err := json.MarshalIndent(s.DecryptedSecureJSONData, "", "  ")
		if err == nil {
			decryptedDataStr = "\n" + string(decryptedBytes)
		} else {
			decryptedDataStr = "\n(map marshaling error)"
		}
	} else {
		decryptedDataStr = "nil"
	}

	return fmt.Sprintf(`DataSourceInstanceSettings{
  ID: %d
  UID: %s
  Type: %s
  Name: %s
  URL: %s
  User: %s
  Database: %s
  BasicAuthEnabled: %t
  BasicAuthUser: %s
  JSONData: %s
  DecryptedSecureJSONData: %s
  Updated: %s
  APIVersion: %s
}`,
		s.ID,
		s.UID,
		s.Type,
		s.Name,
		s.URL,
		s.User,
		s.Database,
		s.BasicAuthEnabled,
		s.BasicAuthUser,
		jsonDataStr,
		decryptedDataStr,
		s.Updated.Format(time.RFC3339),
		s.APIVersion,
	)
}

func FieldTypeToString(ft data.FieldType) string {
	switch ft {
	case data.FieldTypeUnknown:
		return "FieldTypeUnknown"
	case data.FieldTypeInt8:
		return "FieldTypeInt8"
	case data.FieldTypeNullableInt8:
		return "FieldTypeNullableInt8"
	case data.FieldTypeInt16:
		return "FieldTypeInt16"
	case data.FieldTypeNullableInt16:
		return "FieldTypeNullableInt16"
	case data.FieldTypeInt32:
		return "FieldTypeInt32"
	case data.FieldTypeNullableInt32:
		return "FieldTypeNullableInt32"
	case data.FieldTypeInt64:
		return "FieldTypeInt64"
	case data.FieldTypeNullableInt64:
		return "FieldTypeNullableInt64"
	case data.FieldTypeUint8:
		return "FieldTypeUint8"
	case data.FieldTypeNullableUint8:
		return "FieldTypeNullableUint8"
	case data.FieldTypeUint16:
		return "FieldTypeUint16"
	case data.FieldTypeNullableUint16:
		return "FieldTypeNullableUint16"
	case data.FieldTypeUint32:
		return "FieldTypeUint32"
	case data.FieldTypeNullableUint32:
		return "FieldTypeNullableUint32"
	case data.FieldTypeUint64:
		return "FieldTypeUint64"
	case data.FieldTypeNullableUint64:
		return "FieldTypeNullableUint64"
	case data.FieldTypeFloat32:
		return "FieldTypeFloat32"
	case data.FieldTypeNullableFloat32:
		return "FieldTypeNullableFloat32"
	case data.FieldTypeFloat64:
		return "FieldTypeFloat64"
	case data.FieldTypeNullableFloat64:
		return "FieldTypeNullableFloat64"
	case data.FieldTypeString:
		return "FieldTypeString"
	case data.FieldTypeNullableString:
		return "FieldTypeNullableString"
	case data.FieldTypeBool:
		return "FieldTypeBool"
	case data.FieldTypeNullableBool:
		return "FieldTypeNullableBool"
	case data.FieldTypeTime:
		return "FieldTypeTime"
	case data.FieldTypeNullableTime:
		return "FieldTypeNullableTime"
	case data.FieldTypeJSON:
		return "FieldTypeJSON"
	case data.FieldTypeNullableJSON:
		return "FieldTypeNullableJSON"
	case data.FieldTypeEnum:
		return "FieldTypeEnum"
	case data.FieldTypeNullableEnum:
		return "FieldTypeNullableEnum"
	default:
		return "FieldTypeUnknown"
	}
}
