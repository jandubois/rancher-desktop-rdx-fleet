---
description: Learn how to install and use PostgreSQL
lang: en
robots: index, follow
title: PostgreSQL \| SUSE Application Collection
twitter:card: summary
twitter:description: Learn how to install and use PostgreSQL
twitter:title: PostgreSQL
viewport: width=device-width,initial-scale=1,shrink-to-fit=no
---


1.  [Reference guides](...md)
2.  PostgreSQL


# PostgreSQL


Learn how to install and use PostgreSQL


![PostgreSQL Logo](images/reference-guides/logo-postgresql.png "PostgreSQL Logo")

## Get started

[PostgreSQL](https://apps.rancher.io/applications/postgresql) is an advanced object-relational database management system that supports an extended subset of the SQL standard, including transactions, foreign keys, subqueries, triggers, user-defined types and functions.

Before exploring the chart characteristics, let’s start by deploying the default configuration:


```
helm install <release-name> oci://dp.apps.rancher.io/charts/postgresql \
    --set global.imagePullSecrets={application-collection}
```


> Please check our [authentication guide](../../get-started/authentication/index.html#kubernetes) if you need to configure Application Collection OCI credentials in your Kubernetes cluster.

## Container overview

The PostgreSQL binaries are packaged as container images in Application Collection and the Helm chart makes use of these container images. Any application-related documentation provided by upstream will work out of the box with our containers. You can check the [official PostgreSQL documentation](https://www.postgresql.org/docs/). Find the latest PostgreSQL container artifacts in [Application Collection](https://apps.rancher.io/artifacts?name=%22postgresql%22).

The [section below](index.html#override-the-postgresql-image) explains how to override the default container image in the PostgreSQL Helm chart.

### Flavors

Application Collection offers flavored container images for PostgreSQL. These flavors can be differentiated by their container tags:

- Default flavor: The base flavor only bundles the core of PostgreSQL and it is the default in the Helm chart package.
- Contrib flavor `contrib`: This flavor contains extensions and additions that are part of the PostgreSQL codebase, but not (yet) officially part of the core.

## Chart overview

The PostgreSQL Helm chart distributed in Application Collection is made from scratch, which allowed us to include every best practice and standardization we deemed necessary. When creating it, the objective was to keep the underlying PostgreSQL features intact while simplifying some of its mechanisms when deployed in a Kubernetes environment.

By default, the chart will deploy a [StatefulSet](https://kubernetes.io/docs/concepts/workloads/controllers/statefulset/) with a single PostgreSQL server enabling password-based authentication. The PostgreSQL data is stored in a `8Gi` persistent volume defined by the related volume claim template.

## Chart configuration

To view the supported configuration options and documentation, run:


```
helm show values oci://dp.apps.rancher.io/charts/postgresql
```


To view the contents of the Helm chart’s README file, run:


```
helm show readme oci://dp.apps.rancher.io/charts/postgresql
```


### Override the PostgreSQL image

The Helm chart parameters allow to override the default container image used in the installation by setting another specific container image tag of a different flavor as explained in the [Container overview](index.html#container-overview) section.

To use the `*-contrib` flavor, you would install the Helm chart providing the following values file (`contrib.yaml`):


```
images:
  postgresql:
    tag: "17.5-contrib"
```


```
helm install <release-name> oci://dp.apps.rancher.io/charts/postgresql \
    --set global.imagePullSecrets={application-collection} \
    --values contrib.yaml
```


Or equivalently, as command line flags:


```
helm install <release-name> oci://dp.apps.rancher.io/charts/postgresql \
    --set global.imagePullSecrets={application-collection} \
    --set images.postgresql.tag=17.5-contrib
```


### PostgreSQL users

By default, the Helm chart creates a couple of PostgreSQL users. A superuser `postgres` and a replication user `replication`. The passwords are randomly generated on installation.


```
auth:
  postgresUsername: postgres
  postgresPassword: ""
  replicationUsername: replication
  replicationPassword: ""
```


The Helm chart also allows to create a custom database and a specific user for that database via Helm chart parameters in the values file (`custom_database.yaml`) on Helm chart installation:


```
auth:
  database: mydatabase
  username: myuser
  password: mypassword
```


```
helm install <release-name> oci://dp.apps.rancher.io/charts/postgresql \
    --set global.imagePullSecrets={application-collection} \
    --values custom_database.yaml
```


Or equivalently, as command line flags:


```
helm install <release-name> oci://dp.apps.rancher.io/charts/postgresql \
    --set global.imagePullSecrets={application-collection} \
    --set auth.database=mydatabase,auth.username=myuser,auth.password=mypassword
```


To show all the configured users, run:


```
$ kubectl exec sts/<release-name>-postgresql -- psql -c '\du'
                              List of roles
  Role name  |                         Attributes
-------------+------------------------------------------------------------
 myuser      |
 postgres    | Superuser, Create role, Create DB, Replication, Bypass RLS
 replication | Replication
```


Find all the authentication options in the [values and the README files](index.html#chart-configuration) under `auth.*`.

### TLS

SSL/TLS can be enabled via the `tls.*` Helm chart parameters. Find all the TLS options in the [values and the README files](index.html#chart-configuration). To cover this feature with a simple example, let’s configure a PostgreSQL installation to allow connections to the database via TLS.

First, generate a TLS certificate. Read how to do it [here](https://kubernetes.io/docs/tasks/administer-cluster/certificates) if needed. You can use [cert-manager](https://apps.rancher.io/applications/cert-manager) as well.

Once it is generated, create the Kubernetes secret for that certificate:


```
kubectl create secret generic server-cert --from-file ca.crt --from-file server.crt --from-file server.key
```


Install the PostgreSQL Helm chart providing the following parameters (`tls.yaml`):


```
tls:
  enabled: true
  existingSecret: server-cert
  certFilename: server.crt
  keyFilename: server.key
  caCertFilename: ca.crt
```


```
helm install <release-name> oci://dp.apps.rancher.io/charts/postgresql \
    --set global.imagePullSecrets={application-collection} \
    --values tls.yaml
```


TLS connections are now allowed:


```
PGPASSWORD=$(kubectl get secret <release-name>-postgresql -o jsonpath='{.data.postgresPassword}' | base64 -D)
kubectl run -it --rm postgresql-client --restart=Never --image=dp.apps.rancher.io/containers/postgresql:17 \
    --env PGSSLMODE=require --env PGPASSWORD=$PGPASSWORD -- psql -Upostgres -h <release-name>-postgresql -c 'SELECT 1'
```


### Configuration files

The Helm chart allows to customize the PostgreSQL configuration files. Find more details in the [values and the README files](index.html#chart-configuration):


```
configurationFile: postgresql.conf
hbaConfigurationFile: pg_hba.conf
identConfigurationFile: pg_ident.conf
configuration: ""
hbaConfiguration: ""
identConfiguration: ""
```


As an example, to customize the `pg_hba.conf` configuration to only allow external connections for a particular user and database, the Helm chart values below can be provided (`limited.yaml`). Refer to the [PostgreSQL users](index.html#postgresql-users) section for more details on the authentication parameters.


```
auth:
  database: mydatabase
  username: myuser
  password: mypassword

hbaConfiguration: |
  local   all          all                  scram-sha-256
  host    mydatabase   myuser   0.0.0.0/0   scram-sha-256
```


Then, install the Helm chart as follows:


```
helm install <release-name> oci://dp.apps.rancher.io/charts/postgresql \
    --set global.imagePullSecrets={application-collection} \
    --values limited.yaml
```


Now only a specific user and database are allowed externally:


```
$ PGPASSWORD=$(kubectl get secret <release-name>-postgresql -o jsonpath='{.data.postgresPassword}' | base64 -D)

$ kubectl run -it --rm postgresql-client --restart=Never --image=dp.apps.rancher.io/containers/postgresql:17 \
    --env PGPASSWORD=$PGPASSWORD -- psql -Upostgres -h <release-name>-postgresql -c 'SELECT 1'
psql: error: connection to server at "<release-name>-postgresql" (10.43.159.45), port 5432 failed: FATAL:  no pg_hba.conf entry for host "10.42.0.59", user "postgres", database "postgres", no encryption

$ kubectl run -it --rm postgresql-client --restart=Never --image=dp.apps.rancher.io/containers/postgresql:17 \
    --env PGPASSWORD=mypassword -- psql -Umyuser -h <release-name>-postgresql -d mydatabase -c 'SELECT 1'
 ?column?
----------
        1
(1 row)
```


### Initialize the database

This container image supports a mechanism to initialize the database via shell scripts and SQL scripts to be read during the initialization of the server. They can be used to populate it with certain custom data such as tables and rows, as well as configurations. Any files mounted into the `/docker-entrypoint-initdb.d` folder will be executed to initialize the PostgreSQL database. The Helm chart is flexible enough to allow mounting as many as you want. The following extensions are supported:

- `*.sh`
- `*.sql`
- `*.sql.gz`
- `*.sql.xz`
- `*.sql.zst`

As a simple example, to populate PostgreSQL with a couple of databases, you would provide the Helm chart values below (`initdb.yaml`):


```
extraManifests:
  - apiVersion: v1
    kind: ConfigMap
    metadata:
      name: postgresql-initdb
    data:
      initdb.sql: |
        -- Sample databases to create on initialization
        CREATE DATABASE mydatabase1;
        CREATE DATABASE mydatabase2;
podTemplates:
  volumes:
    initdb:
      enabled: true
      configMap:
        name: postgresql-initdb
        defaultMode: 0o440
  containers:
    postgresql:
      volumeMounts:
        initdb:
          enabled: true
          mountPath: /docker-entrypoint-initdb.d/
```


Then, install the Helm chart as follows:


```
helm install <release-name> oci://dp.apps.rancher.io/charts/postgresql \
    --set global.imagePullSecrets={application-collection} \
    --values initdb.yaml
```


During the PostgreSQL initialization, the databases are created:


```
$ kubectl logs -f sts/<release-name>-postgresql
...
Executing init script: /docker-entrypoint-initdb.d/initdb.sql
CREATE DATABASE
CREATE DATABASE
...
$ kubectl exec sts/<release-name>-postgresql -- psql -l
                                                     List of databases
    Name     |  Owner   | Encoding | Locale Provider |  Collate   |   Ctype    | Locale | ICU Rules |   Access privileges
-------------+----------+----------+-----------------+------------+------------+--------+-----------+-----------------------
 mydatabase1 | postgres | UTF8     | libc            | en_US.utf8 | en_US.utf8 |        |           |
 mydatabase2 | postgres | UTF8     | libc            | en_US.utf8 | en_US.utf8 |        |           |
...
```


### Scale PostgreSQL

By default, the Helm chart deploys a single pod. The [StatefulSet](https://kubernetes.io/docs/concepts/workloads/controllers/statefulset/) replicas can be scaled and PostgreSQL automatically replicates the data from the primary to the standby nodes by using the built-in [Streaming Replication](https://www.postgresql.org/docs/current/warm-standby.html#STREAMING-REPLICATION) feature (replication without failover).

The number of replicas can be defined via Helm chart parameters. To deploy 3 PostgreSQL nodes (1 primary, 2 standby) you would pass the following values file (`replication.yaml`):


```
nodeCount: 3
```


```
helm install <release-name> oci://dp.apps.rancher.io/charts/postgresql \
    --set global.imagePullSecrets={application-collection} \
    --values replication.yaml
```


Or equivalently, as command line flags:


```
helm install <release-name> oci://dp.apps.rancher.io/charts/postgresql \
    --set global.imagePullSecrets={application-collection} \
    --set nodeCount=3
```


After the nodes are initialized, you can see how doing certain write operation in the primary node, for example, create a database, is reflected in the standby nodes:


```
$ kubectl exec <release-name>-postgresql-0 -- psql -c 'CREATE DATABASE mydatabase'
CREATE DATABASE

$ kubectl exec <release-name>-postgresql-1 -- psql -l
                                                     List of databases
    Name    |  Owner   | Encoding | Locale Provider |  Collate   |   Ctype    | Locale | ICU Rules |   Access privileges
------------+----------+----------+-----------------+------------+------------+--------+-----------+-----------------------
 mydatabase | postgres | UTF8     | libc            | en_US.utf8 | en_US.utf8 |        |           |
...
```


### Persistence

By default, the PostgreSQL data persistence is achieved via persistent volume claims, 1 per replica, of `8Gi` each. The size and other persistence settings are configurable via Helm chart `persistence.*` parameters. Find all the persistence options in the [values and the README files](index.html#chart-configuration).

As an example, to configure `16Gi` sized persistent volume claims, you would pass the following values file (`persistence.yaml`) to the installation command:


```
persistence:
  resources:
    requests:
      storage: 16Gi
```


```
helm install <release-name> oci://dp.apps.rancher.io/charts/postgresql \
    --set global.imagePullSecrets={application-collection} \
    --values persistence.yaml
```


Or equivalently, as command line flags:


```
helm install <release-name> oci://dp.apps.rancher.io/charts/postgresql \
    --set global.imagePullSecrets={application-collection} \
    --set persistence.resources.requests.storage=16Gi
```


### Metrics

The PostgreSQL Helm chart can deploy a metrics exporter as a sidecar container that exposes Prometheus metrics to be scraped by a Prometheus server. The metrics exporter is deactivated by default but it can be enabled via Helm chart parameters (`metrics.yaml`):


```
metrics:
  enabled: true
```


```
helm install <release-name> oci://dp.apps.rancher.io/charts/postgresql \
    --set global.imagePullSecrets={application-collection} \
    --values metrics.yaml
```


Or equivalently, as command line flags:


```
helm install <release-name> oci://dp.apps.rancher.io/charts/postgresql \
    --set global.imagePullSecrets={application-collection} \
    --set metrics.enabled=true
```


Prometheus metrics can be scraped now:


```
$ kubectl port-forward svc/<release-name>-postgresql-metrics 9187

$ curl -s localhost:9187/metrics | grep pg_replication_is_replica
# HELP pg_replication_is_replica Indicates if the server is a replica
# TYPE pg_replication_is_replica gauge
pg_replication_is_replica 0
```


## Operations

### Adapt volume permissions

The PostgreSQL Helm chart has a feature to adapt and prepare volume permissions before the database initialization. Depending on the environment where you are deploying the Helm chart, this can be necessary to run the application. You can activate the feature via Helm chart parameters (`adapt_permissions.yaml`):


```
podTemplates:
  initContainers:
    volume-permissions:
      enabled: true
```


```
helm install <release-name> oci://dp.apps.rancher.io/charts/postgresql \
    --set global.imagePullSecrets={application-collection} \
    --values adapt_permissions.yaml
```


Or equivalently, as command line flags:


```
helm install <release-name> oci://dp.apps.rancher.io/charts/postgresql \
    --set global.imagePullSecrets={application-collection} \
    --set podTemplates.initContainers.volume-permissions.enabled=true
```


Usually, you only need to adapt the permissions once. After PostgreSQL is properly running, you can [upgrade the Helm chart](index.html#upgrade-the-chart) and deactivate the volume-permissions init container:


```
helm upgrade <release-name> oci://dp.apps.rancher.io/charts/postgresql \
    --reuse-values --set podTemplates.initContainers.volume-permissions.enabled=false
```


### Upgrade the chart

In general, an in-place upgrade of your PostgreSQL installation can be performed using the built-in Helm upgrade workflow:


```
helm upgrade <release-name> oci://dp.apps.rancher.io/charts/postgresql
```


The pods will be upgraded by following the update strategy defined in the `values.yaml` file.

> Be aware that changes from version to version may include breaking changes in PostgreSQL itself or in the Helm chart templates. In other cases, the upgrade process may require additional steps to be performed. Always check the [release notes](https://www.postgresql.org/docs/release/) before proceeding with an upgrade.

### Uninstall the chart

Removing an installed PostgreSQL Helm chart release is simple:


```
helm uninstall <release-name>
```


The PostgreSQL nodes are deployed as [StatefulSets](https://kubernetes.io/docs/concepts/workloads/controllers/statefulset/), hence using [Volume Claim Templates](https://kubernetes.io/docs/concepts/workloads/controllers/statefulset/#volume-claim-templates) to store your most precious resource in a database installation: your data. These PVCs are not directly controlled by Helm and they are not removed when uninstalling the related chart.

When you are ready to remove the PVCs and your data, you will need to explicitly delete them:


```
kubectl delete pvc --selector app.kubernetes.io/instance=<release-name>
```


Last modified October 31, 2025


