---
description: Learn how to install and use MariaDB
lang: en
robots: index, follow
title: MariaDB \| SUSE Application Collection
twitter:card: summary
twitter:description: Learn how to install and use MariaDB
twitter:title: MariaDB
viewport: width=device-width,initial-scale=1,shrink-to-fit=no
---


1.  [Reference guides](...md)
2.  MariaDB


# MariaDB


Learn how to install and use MariaDB


![MariaDB Logo](images/reference-guides/logo-mariadb.png "MariaDB Logo")

## Get started

[MariaDB](https://apps.rancher.io/applications/mariadb) Server is one of the most popular open source relational databases. It’s made by the original developers of MySQL and guaranteed to stay open source. It is part of most cloud offerings and the default in most Linux distributions.

Before exploring the chart characteristics, let’s start by deploying the default configuration:


```
helm install <release-name> oci://dp.apps.rancher.io/charts/mariadb \
    --set global.imagePullSecrets={application-collection}
```


> Please check our [authentication guide](../../get-started/authentication/index.html#kubernetes) if you need to configure Application Collection OCI credentials in your Kubernetes cluster.

## Chart overview

The MariaDB Helm chart distributed in Application Collection is made from scratch, which allowed us to include every best practice and standardization we deemed necessary. When creating it, the objective was to keep the underlying MariaDB features intact while simplifying some of its mechanisms when deployed in a Kubernetes environment.

By default, the chart will deploy a [StatefulSet](https://kubernetes.io/docs/concepts/workloads/controllers/statefulset/) with a single MariaDB server enabling password-based authentication. The MariaDB data is stored in a `8Gi` persistent volume defined by the related volume claim template.

## Chart configuration

To view the supported configuration options and documentation, run:


```
helm show values oci://dp.apps.rancher.io/charts/mariadb
```


To view the contents of the Helm chart’s README file, run:


```
helm show readme oci://dp.apps.rancher.io/charts/mariadb
```


### MariaDB users

By default, the Helm chart creates a couple of MariaDB users. A superuser `root` and a replication user `repl`. The passwords are randomly generated on installation.


```
auth:
  rootPassword: ""
  replicationUsername: repl
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
helm install <release-name> oci://dp.apps.rancher.io/charts/mariadb \
    --set global.imagePullSecrets={application-collection} \
    --values custom_database.yaml
```


Or equivalently, as command line flags:


```
helm install <release-name> oci://dp.apps.rancher.io/charts/mariadb \
    --set global.imagePullSecrets={application-collection} \
    --set auth.database=mydatabase,auth.username=myuser,auth.password=mypassword
```


To show all the configured users, run:


```
$ ROOT_PASSWORD=$(kubectl get secret --namespace default <release-name>-mariadb -o jsonpath="{.data.rootPassword}" | base64 -D)
$ kubectl exec -it sts/<release-name>-mariadb -- mariadb -u root -p$ROOT_PASSWORD -e 'SELECT UNIQUE User FROM mysql.user;'
+-------------+
| User        |
+-------------+
| myuser      |
| repl        |
| root        |
| healthcheck |
| mariadb.sys |
+-------------+
```


Find all the authentication options in the [values and the README files](index.html#chart-configuration) under `auth.*`.

### TLS

SSL/TLS can be enabled via the `tls.*` Helm chart parameters. Find all the TLS options in the [values and the README files](index.html#chart-configuration). To cover this feature with a simple example, let’s configure a MariaDB installation to allow connections to the database via TLS.

- First, generate a TLS certificate. Read how to do it [here](https://kubernetes.io/docs/tasks/administer-cluster/certificates) if needed. You can use [cert-manager](https://apps.rancher.io/applications/cert-manager) as well.

- Once it is generated, create the Kubernetes secret for that certificate:

  

  ```
  kubectl create secret generic server-cert --from-file ca.crt --from-file server.crt --from-file server.key
  ```

  

- Install the MariaDB Helm chart providing the following parameters (`tls.yaml`):

  

  ```
  tls:
    enabled: true
    existingSecret: server-cert
    requireSecureTransport: true
    certFilename: server.crt
    keyFilename: server.key
    caCertFilename: ca.crt
  ```

  

  

  ```
  helm install <release-name> oci://dp.apps.rancher.io/charts/mariadb \
      --set global.imagePullSecrets={application-collection} \
      --values tls.yaml
  ```

  

- Check TLS connections. They are now required:

  

  ```
  $ ROOT_PASSWORD=$(kubectl get secret <release-name>-mariadb -o jsonpath='{.data.rootPassword}' | base64 -D)
  $ kubectl run -it --rm mariadb-client --restart=Never --image=dp.apps.rancher.io/containers/mariadb:11.8 \
      -- mariadb -u root -p$ROOT_PASSWORD -h <release-name>-mariadb -e 'SELECT 1;' --ssl=false
  ERROR 3159 (08004): Connections using insecure transport are prohibited while --require_secure_transport=ON.
  ```

  

### Configuration files

The Helm chart allows to provide extra configurations to be read by MariaDB. Find more details in the [values and the README files](index.html#chart-configuration) and in the [official documentation](https://mariadb.com/docs/server/server-management/install-and-upgrade-mariadb/configuring-mariadb/configuring-mariadb-with-option-files):


```
configurationFile: extra.cnf
configuration: ""
existingConfigMap: ""
```


As an example, to customize the maximum number of simultaneous client connections to `20`, the Helm chart values below can be provided (`config.yaml`):


```
configuration: |
  [mariadb]
  max_connections = 20
```


Alternatively, to split the configuration in multiple files:


```
configuration: |
  !include /mnt/mariadb/conf/max_connections.cnf
configMap:
  max_connections.cnf: |
    [mariadb]
    max_connections = 20
```


Then, install the Helm chart as follows:


```
helm install <release-name> oci://dp.apps.rancher.io/charts/mariadb \
    --set global.imagePullSecrets={application-collection} \
    --values config.yaml
```


Now the `max_connections` variable is set to the desired value:


```
$ ROOT_PASSWORD=$(kubectl get secret <release-name>-mariadb -o jsonpath='{.data.rootPassword}' | base64 -D)
$ kubectl run -it --rm mariadb-client --restart=Never --image=dp.apps.rancher.io/containers/mariadb:11.8 \
    -- mariadb -u root -p$ROOT_PASSWORD -h <release-name>-mariadb -e 'SHOW VARIABLES LIKE "max_connections";'
+-----------------+-------+
| Variable_name   | Value |
+-----------------+-------+
| max_connections | 20    |
+-----------------+-------+
```


### Initialize the database

This container image supports a mechanism to initialize the database via shell scripts and SQL scripts to be read during the initialization of the server. They can be used to populate it with certain custom data such as tables and rows, as well as configurations. Any files mounted into the `/docker-entrypoint-initdb.d` folder will be executed to initialize the MariaDB database. The Helm chart is flexible enough to allow mounting as many as you want. The following extensions are supported:

- `*.sh`
- `*.sql`
- `*.sql.gz`
- `*.sql.xz`
- `*.sql.zst`

As a simple example, to populate MariaDB with a couple of databases, you would provide the Helm chart values below (`initdb.yaml`):


```
extraManifests:
  - apiVersion: v1
    kind: ConfigMap
    metadata:
      name: mariadb-initdb
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
        name: mariadb-initdb
        defaultMode: 0o440
  containers:
    mariadb:
      volumeMounts:
        initdb:
          enabled: true
          mountPath: /docker-entrypoint-initdb.d/
```


Then, install the Helm chart as follows:


```
helm install <release-name> oci://dp.apps.rancher.io/charts/mariadb \
    --set global.imagePullSecrets={application-collection} \
    --values initdb.yaml
```


During the MariaDB initialization, the databases are created:


```
$ kubectl logs -f sts/<release-name>-mariadb
...
2025-09-01 07:47:32+00:00 [Note] [Entrypoint]: /usr/bin/docker-entrypoint.sh: running /docker-entrypoint-initdb.d/initdb.sql
...
$ ROOT_PASSWORD=$(kubectl get secret <release-name>-mariadb -o jsonpath='{.data.rootPassword}' | base64 -D)
$ kubectl exec -it sts/<release-name>-mariadb -- mariadb -u root -p$ROOT_PASSWORD -e 'SHOW DATABASES;'
+--------------------+
| Database           |
+--------------------+
| information_schema |
| mydatabase1        |
| mydatabase2        |
| mysql              |
| performance_schema |
| sys                |
+--------------------+
```


### Scale MariaDB

By default, the Helm chart deploys a single pod. The [StatefulSet](https://kubernetes.io/docs/concepts/workloads/controllers/statefulset/) replicas can be scaled and MariaDB automatically replicates the data from the primary to the replica nodes by using the built-in [Standard Replication](https://mariadb.com/docs/server/ha-and-performance/standard-replication/setting-up-replication) feature.

The number of replicas can be defined via Helm chart parameters. To deploy 3 MariaDB nodes (1 primary, 2 replicas) you would pass the following values file (`replication.yaml`):


```
nodeCount: 3
```


```
helm install <release-name> oci://dp.apps.rancher.io/charts/mariadb \
    --set global.imagePullSecrets={application-collection} \
    --values replication.yaml
```


Or equivalently, as command line flags:


```
helm install <release-name> oci://dp.apps.rancher.io/charts/mariadb \
    --set global.imagePullSecrets={application-collection} \
    --set nodeCount=3
```


After the nodes are initialized, you can see how doing certain write operation in the primary node, for example, create a database, is reflected in the replica nodes:


```
$ ROOT_PASSWORD=$(kubectl get secret <release-name>-mariadb -o jsonpath='{.data.rootPassword}' | base64 -D)
$ kubectl exec <release-name>-mariadb-0 -- mariadb -u root -p$ROOT_PASSWORD -e 'CREATE DATABASE mydatabase;'
CREATE DATABASE
$ kubectl exec -it <release-name>-mariadb-1 -- mariadb -u root -p$ROOT_PASSWORD -e 'SHOW DATABASES;'
+--------------------+
| Database           |
+--------------------+
| information_schema |
| mydatabase         |
| mysql              |
| performance_schema |
| sys                |
+--------------------+
```


### Persistence

By default, the MariaDB data persistence is achieved via persistent volume claims, 1 per replica, of `8Gi` each. The size and other persistence settings are configurable via Helm chart `persistence.*` parameters. Find all the persistence options in the [values and the README files](index.html#chart-configuration).

As an example, to configure `16Gi` sized persistent volume claims, you would pass the following values file (`persistence.yaml`) to the installation command:


```
persistence:
  resources:
    requests:
      storage: 16Gi
```


```
helm install <release-name> oci://dp.apps.rancher.io/charts/mariadb \
    --set global.imagePullSecrets={application-collection} \
    --values persistence.yaml
```


Or equivalently, as command line flags:


```
helm install <release-name> oci://dp.apps.rancher.io/charts/mariadb \
    --set global.imagePullSecrets={application-collection} \
    --set persistence.resources.requests.storage=16Gi
```


### Metrics

The MariaDB Helm chart can deploy a metrics exporter as a sidecar container that exposes Prometheus metrics to be scraped by a Prometheus server. The metrics exporter is deactivated by default but it can be enabled via Helm chart parameters (`metrics.yaml`):


```
metrics:
  enabled: true
```


```
helm install <release-name> oci://dp.apps.rancher.io/charts/mariadb \
    --set global.imagePullSecrets={application-collection} \
    --values metrics.yaml
```


Or equivalently, as command line flags:


```
helm install <release-name> oci://dp.apps.rancher.io/charts/mariadb \
    --set global.imagePullSecrets={application-collection} \
    --set metrics.enabled=true
```


Prometheus metrics can be scraped now:


```
$ kubectl port-forward svc/<release-name>-mariadb-metrics 9104
$ curl -s localhost:9104/metrics | grep mysql_up
# HELP mysql_up Whether the MySQL server is up.
# TYPE mysql_up gauge
mysql_up 1
```


## Operations

### Adapt volume permissions

The MariaDB Helm chart has a feature to adapt and prepare volume permissions before the database initialization. Depending on the environment where you are deploying the Helm chart, this can be necessary to run the application. You can activate the feature via Helm chart parameters (`adapt_permissions.yaml`):


```
podTemplates:
  initContainers:
    volume-permissions:
      enabled: true
```


```
helm install <release-name> oci://dp.apps.rancher.io/charts/mariadb \
    --set global.imagePullSecrets={application-collection} \
    --values adapt_permissions.yaml
```


Or equivalently, as command line flags:


```
helm install <release-name> oci://dp.apps.rancher.io/charts/mariadb \
    --set global.imagePullSecrets={application-collection} \
    --set podTemplates.initContainers.volume-permissions.enabled=true
```


Usually, you only need to adapt the permissions once. After MariaDB is properly running, you can [upgrade the Helm chart](index.html#upgrade-the-chart) and deactivate the volume-permissions init container:


```
helm upgrade <release-name> oci://dp.apps.rancher.io/charts/mariadb \
    --reuse-values --set podTemplates.initContainers.volume-permissions.enabled=false
```


### Upgrade the chart

In general, an in-place upgrade of your MariaDB installation can be performed using the built-in Helm upgrade workflow. Make sure that if you really want to upgrade your MariaDB database including the system tables, you must provide additional Helm chart parameters explicitly:


```
helm upgrade <release-name> oci://dp.apps.rancher.io/charts/mariadb \
    --reuse-values --set upgrade.enabled=true
```


The pods will be upgraded by following the update strategy defined in the `values.yaml` file.

> Be aware that changes from version to version may include breaking changes in MariaDB itself or in the Helm chart templates. In other cases, the upgrade process may require additional steps to be performed. Always check the [release notes](https://mariadb.com/docs/release-notes/community-server) before proceeding with an upgrade.

### Uninstall the chart

Removing an installed MariaDB Helm chart release is simple:


```
helm uninstall <release-name>
```


The MariaDB nodes are deployed as [StatefulSets](https://kubernetes.io/docs/concepts/workloads/controllers/statefulset/), hence using [Volume Claim Templates](https://kubernetes.io/docs/concepts/workloads/controllers/statefulset/#volume-claim-templates) to store your most precious resource in a database installation: your data. These PVCs are not directly controlled by Helm and they are not removed when uninstalling the related chart.

When you are ready to remove the PVCs and your data, you will need to explicitly delete them:


```
kubectl delete pvc --selector app.kubernetes.io/instance=<release-name>
```


Last modified October 31, 2025


