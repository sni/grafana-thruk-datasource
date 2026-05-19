package plugin

import (
	"encoding/base64"
	"net/url"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

func getQueryParam(rawURL string, key string) string {
	u, err := url.Parse(rawURL)
	if err != nil {
		return ""
	}
	return u.Query().Get(key)
}

func buildBasicAuth(s backend.DataSourceInstanceSettings) string {
	if s.BasicAuthEnabled && s.BasicAuthUser != "" {
		password := s.DecryptedSecureJSONData["basicAuthPassword"]
		auth := s.BasicAuthUser + ":" + password
		return "Basic " + base64.StdEncoding.EncodeToString([]byte(auth))
	}
	return ""
}

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

func buildMetaColumnMap(resp *thrukResponse) map[string]metaColumn {
	m := make(map[string]metaColumn)
	if resp.Meta != nil {
		for _, c := range resp.Meta.Columns {
			m[c.Name] = c
		}
	}
	return m
}
