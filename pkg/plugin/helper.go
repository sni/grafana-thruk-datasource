package plugin

import (
	"encoding/base64"
	"log"
	"net/url"
	"os"
	"path/filepath"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
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
	return
}
