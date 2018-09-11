## Thruk Grafana Datasource - a Grafana backend datasource using Thruks REST API

### Installation

Search for `thruk` in the Grafana plugins directory or simply use the grafana-cli command:

    grafana-cli plugins install sni-thruk-datasource

Also [OMD-Labs](https://labs.consol.de/omd/) comes with this datasource included, so if
you use OMD-Labs, everything is setup already.

Otherwise follow these steps:

    %> cd var/grafana/plugins
    %> git clone https://github.com/sni/grafana-thruk-datasource.git
    %> restart grafana


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

```
  SELECT time, message FROM logs WHERE host_name = 'test'
```

#### Changelog

1.0.0  2018-09-03
    - inital release
