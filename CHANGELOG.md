### Changelog

2.2.1  2025-07-24
    - add provisioning to dev container
    - all querys have a default limit of 1000 unless specified otherwise
    - require grafana 11.6

2.2.0  2025-04-10
    - rework query editor select fields
    - replace variables in columns

2.1.2  2025-01-15
    - fix remove columns button
    - fix broken query if FROM contains url parameter already

2.1.1  2024-08-02
    - remove console.log debug output

2.1.0  2024-08-02
    - improve query editor

2.0.8  2024-05-14
    - add support for stats queries as timeseries having multiple name columns

2.0.7  2024-04-23
    - improve query parsing for variable queries

2.0.6  2024-04-23
    - add url encode helper to query editor

2.0.5  2024-04-19
    - add support for column field config as part of the query result
    - make from and columns field editable in the queryeditor
    - make column selection work for hash response data

2.0.4  2023-12-04
    - remove time filter restriction
    - update grafana toolkit to 10.1.5

2.0.3  2023-07-14
    - make drag/drop more obvious
    - set correct field type for numeric columns
    - fix removing * from column list

2.0.2  2023-05-30
    - fix using variables in path/from field

2.0.1  2022-12-02
    - fix syntax error in variables query

2.0.0  2022-10-28
    - rebuild with react for grafana 9
    - add support for logs explorer
    - query editor:
        - support sorting columns

1.0.7  2022-02-11
    - rebuild for grafana 8
    - update dependencies

1.0.6  2021-01-04
    - sign plugin
    - switch package builds to yarn

1.0.5  2020-09-11
    - improve packaging

1.0.4  2020-06-29
    - fix export with "Export for sharing externally" enabled

1.0.3  2019-02-15
    - support aggregation functions
    - convert hash responses into tables
    - support timeseries based panels

1.0.2  2019-01-04
    - add more time styles

1.0.1  2018-09-30
    - fix annotation query parser

1.0.0  2018-09-14
    - inital release
