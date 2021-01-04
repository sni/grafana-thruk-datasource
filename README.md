## Thruk Grafana Datasource - a Grafana backend datasource using Thruks REST API

### Installation

Search for `thruk` in the Grafana plugins directory or simply use the grafana-cli command:

    %> grafana-cli plugins install sni-thruk-datasource

Also [OMD-Labs](https://labs.consol.de/omd/) comes with this datasource included, so if
you use OMD-Labs, everything is setup already.

Otherwise follow these steps:

    %> cd var/grafana/plugins
    %> git clone -b release-1.0.4 https://github.com/sni/grafana-thruk-datasource.git
    %> restart grafana

Replace `release-1.0.4` with the last available release branch.

### Create Datasource

Direct access and proxy datasources are possible.
Add a new datasource and select:

Variant A:

Uses the Grafana proxy. Must have a local user which is used for all queries.

    - Type 'Thruk'
    - Url 'https://localhost/sitename/thruk'
    - Access 'proxy'
    - Basic Auth 'True'
    - User + Password for local thruk user


Variant B:

Uses direct access. Thruk must be accessible from the public.

    - Type 'Thruk'
    - Url 'https://yourhost/sitename/thruk' (Note: this has to be the absolute url)
    - Access 'direct'
    - Http Auth 'With Credentials'

### Metric Queries
This datasource does not support metrics. Only table data format is available.

### Table Queries

Using the table panel, you can display most data from the rest api. However
only text and numbers can be displayed in a sane way.

### Variable Queries

Thruks rest api can be used to fill grafana variables. For example to get all
hosts of a certain hostgroup, use this example query:

```
  SELECT name FROM hosts WHERE groups >= 'linux'
```

### Annotation Queries

Annotation queries can be used to add logfile entries into your graphs.
Please note that annotations are shared across all graphs in a dashboard.

It is important to append the time filter like in this example:

```
  SELECT time, message FROM logs WHERE host_name = 'test' and time = $time
```

### Single Stat Queries
Single stats are best used with REST endpoints which return aggregated values
already or use aggregation functions like, `avg`, `sum`, `min`, `max` or `count`.

### Timeseries based panels
Althouth Thruk isn't a timeseries databases und usually only returns table
data, some queries can be converted to fake timeseries if the panel cannot
handle table data.

For example the pie chart plugin can be used with stats queries like this:

```
  SELECT count() state, state FROM /hosts
```

### Using Variables

Dashboard variables can be used in almost all queries. For example if you
define a dashboard variable named `host` you can then use `$host` in your
queries.

There is a special syntax for time filter: `field = $time` which will be
replaced by `(field >= starttime AND field <= endtime)`. This can be used to
reduce results to the dashboards timeframe.

```
  SELECT time, message FROM /hosts/$host/alerts WHERE time = $time
```

which is the same as

```
  SELECT time, message FROM /alerts WHERE host_name = "$host" AND time = $time
```

### Development

To test and improve the plugin you can run Grafana instance in Docker using
following command (in the source directory of this plugin):

  docker run --rm -it -v $PWD:/var/lib/grafana/plugins/sni-thruk-datasource \
           -p 3000:3000 --name grafana.docker \
           --env=GF_USERS_DEFAULT_THEME=light \
           grafana/grafana

This will expose local plugin from your machine to Grafana container. Now
run `make buildwatch` to compile dist directory and start changes watcher:

  %> make buildwatch


#### Create Release

How to create a new release:

    %> export RELVERSION=1.0.6
    %> export GRAFANA_API_KEY=...
    %> vi README.md # add changelog entry
    %> git commit -am "Release v${RELVERSION}"
    %> git tag -a v${RELVERSION} -m "Create release tag v${RELVERSION}"
    %> make GRAFANA_API_KEY=${GRAFANA_API_KEY} clean releasebuild
    %> make releasepush


### Changelog

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
