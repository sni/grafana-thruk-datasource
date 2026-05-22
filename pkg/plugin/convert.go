package plugin

import (
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

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

func toInt64(v interface{}) int64 {
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

func toString(v interface{}) string {
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
// [root@ebc5fefa4b7c V1]# grep -nrw '"type":' docs.pm > types.txt

// parses the field types sent in Thruk function _get_columns_meta_for_path on API calls
// https://github.com/sni/thruk/commit/8f56bb54633c48e33e1a6ed0ed6d5c5c8f2cc48f?diff=unified
func inferFieldType(columnName string, metaColumns map[string]columnMetadata) (data.FieldType, string) {
	if mc, ok := metaColumns[columnName]; ok {

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
// https://github.com/sni/thruk/commit/8f56bb54633c48e33e1a6ed0ed6d5c5c8f2cc48f?diff=unified
func modifyBasedOnUnitType(columnName string, metaColumns map[string]columnMetadata) {
	if mc, ok := metaColumns[columnName]; ok {
		if mc.Config != nil {
			if cnfConverted, convOk := mc.Config.(struct{ Unit string }); convOk {
				switch cnfConverted.Unit {
				case "%":
					// TODO: percentages are given as direct numbers? like 0.34 or 34
					return
				case "s":
					//
					return
				}
			}
		}
	}
}
