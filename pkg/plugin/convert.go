package plugin

import (
	"encoding/json"
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
