package plugin

import (
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

func anyToTime(v any) time.Time {
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

func anyToFloat64(v any) float64 {
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

func anyToInt64(v any) int64 {
	switch val := v.(type) {
	case int64:
		return val
	case float64:
		return int64(val)
	case json.Number:
		f, err := val.Int64()
		if err == nil {
			return f
		}
	}
	return 0
}

func anyToBool(v any) bool {
	switch val := v.(type) {
	case int64:
		if v.(int64) == 1 {
			return true
		}
		return false
	case float64:
		if v.(float64) == 1 {
			return true
		}
		return false
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

func anyToString(v any) string {
	switch val := v.(type) {
	case string:
		return val
	case int64:
		return fmt.Sprintf("%d", val)
	case float64:
		return fmt.Sprintf("%f", val)
	case bool:
		return fmt.Sprintf("%t", val)
	case []string:
		return strings.Join(val, ",")
	}
	return ""
}

// To get all possible types use something like this:
// [root@ebc5fefa4b7c V1]# pwd
// /src/thruk/lib/Thruk/Controller/Rest/V1
// these types are defined in docs.pm and livestatus_docs.pm
// [root@ebc5fefa4b7c V1]# grep -nrw '"type":' docs.pm > types.txt
func inferFieldType(columnName string, columnMetadatas map[string]columnMetadata) (data.FieldType, string) {
	if mc, ok := columnMetadatas[columnName]; ok {

		// if the columnMetadata has a saved type, use it
		if mc.GrafanaDataType != data.FieldTypeUnknown {
			return mc.GrafanaDataType, mc.Type
		}

		switch mc.Type {
		case "number":
			return data.FieldTypeFloat64, mc.Type
		case "time":
			return data.FieldTypeTime, mc.Type
		case "bool", "boolean":
			return data.FieldTypeBool, mc.Type
		case "string":
			return data.FieldTypeString, mc.Type
		case "array_of_strings":
			return data.FieldTypeString, mc.Type
		default:
			return data.FieldTypeUnknown, "unknown"
		}
	}

	// there is no column metadata for that column
	if strings.HasPrefix(columnName, "last_") || strings.HasPrefix(columnName, "next_") ||
		strings.HasPrefix(columnName, "start_") || strings.HasPrefix(columnName, "end_") ||
		strings.HasPrefix(columnName, "time") {
		return data.FieldTypeTime, ""
	}

	if strings.HasPrefix(columnName, "time_") {
		return data.FieldTypeFloat64, ""
	}

	return data.FieldTypeString, ""
}

// Parses the optional units added in Thruk function _get_columns_meta_for_path on API calls
func processUnitType(columnName string, columnMetadatas map[string]columnMetadata) {
	if mc, ok := columnMetadatas[columnName]; ok {
		if mc.Config != nil {
			if configStructConverted, convOk := mc.Config.(struct{ Unit string }); convOk {
				switch configStructConverted.Unit {
				case "%":
					return
				case "s":
					return
				}
			}
		}
	}
}
