---
description: Learn how to install and use Penpot
lang: en
robots: index, follow
title: Penpot \| SUSE Application Collection
twitter:card: summary
twitter:description: Learn how to install and use Penpot
twitter:title: Penpot
viewport: width=device-width,initial-scale=1,shrink-to-fit=no
---


1.  [Reference guides](...md)
2.  Penpot


# Penpot


Learn how to install and use Penpot


![Penpot Logo](images/reference-guides/logo-penpot.png "Penpot Logo")

## Get started

[Penpot](https://apps.rancher.io/applications/penpot) is the web-based, open-source design tool that bridges the gap between designers and developers. As our first free-tier offering, Penpot only requires authentication to access the application (for more information, see [here](../../get-started/subscriptions.md)).

Before exploring the chart characteristics, let’s deploy an out-of-the-box Penpot instance:


```
helm install <release-name> oci://dp.apps.rancher.io/charts/penpot \
    --set global.imagePullSecrets={application-collection} \
    --set global.postgresqlEnabled=true \
    --set global.redisEnabled=true
```


> Please check our [authentication guide](../../get-started/authentication/index.html#kubernetes) if you need to configure Application Collection OCI credentials in your Kubernetes cluster.

## Chart overview

Our Penpot chart is based on the official [penpot](https://github.com/penpot/penpot-helm/tree/develop/charts/penpot) chart, modified to use our [redis](https://apps.rancher.io/applications/redis) and [postgresql](https://apps.rancher.io/applications/postgresql) charts as subcharts and improved with our best practices. As such, any chart-related documentation provided by upstream will work out of the box with our chart. You can check the official documentation [here](https://help.penpot.app/technical-guide/).

## Chart configuration

To view the supported configuration options and documentation, run:


```
helm show values oci://dp.apps.rancher.io/charts/penpot
```


## Penpot dependencies

The Penpot chart currently requires both Redis and PostgreSQL instances for deployment. Traditionally, these instances needed to be pre-deployed. A new feature, disabled by default, enables deploying them as subcharts. This section will demonstrate how to deploy Penpot using either approach.

### PostgreSQL

#### Deploy PostgreSQL as a subchart

Penpot requires a PostgreSQL instance with specific database and user credentials. When deploying the PostgreSQL subchart, these are automatically configured for a one-click installation. The relevant parameters are set in Penpot’s `values.yaml` file as follows:


```
# PostgreSQL configuration (Check for [more parameters here](https://apps.rancher.io/applications/postgresql))
postgresql:
  auth:
    # -- Name for a custom user to create.
    username: "penpot"
    # -- Password for the custom user to create.
    password: "penpot"
    # -- Name for a custom database to create.
    database: "penpot"
```


Consistency is required between the parameters above and the settings defined for the Penpot Backend pod in the same `values.yaml` file:


```
config:
  postgresql:
    # -- The database username to use.
    username: "penpot"
    # -- The database password to use.
    password: "penpot"
    # -- The PostgreSQL database to use.
    database: "penpot"
```


Since the above configurations are set by default, we only need to enable the PostgreSQL subchart for deployment:


```
helm install <release-name> oci://dp.apps.rancher.io/charts/penpot \
    --set global.imagePullSecrets={application-collection} \
    --set global.postgresqlEnabled=true
```


#### Using an external PostgreSQL instance

In this example, we will deploy a PostgreSQL chart prior to the Penpot deployment. As we are using our custom PostgreSQL chart (also employed as a subchart), we have already covered some of the necessary configuration. A detail we must address is the container flavor used by the PostgreSQL pod. Penpot requires a PostgreSQL instance that includes the `uuid-ossp` extension. Our standard `postgresql` container lacks this, but the `-contrib` flavor provides it; thus, we will replace the default. Finally, to better simulate a production environment, we will install our PostgreSQL chart in a separate namespace:


```
helm install postgresql oci://dp.apps.rancher.io/charts/postgresql -n postgresql-dev \
    --set global.imagePullSecrets={application-collection} \
    --set images.postgresql.tag=17.5-contrib \
    --set auth.username=penpot \
    --set auth.password=penpot \
    --set auth.database=penpot
```


> When deploying the PostgreSQL subchart, the `-contrib` flavor is already defined as default.

Once PostgreSQL is running, we need to configure our Penpot chart to connect to the PostgreSQL service. Note this is necessary even when installing everything in a single namespace:


```
helm install <release-name> oci://dp.apps.rancher.io/charts/penpot \
    --set global.imagePullSecrets={application-collection} \
    --set config.postgresql.host=postgresql.postgresql-dev.svc.cluster.local
```


### Redis

#### Deploy Redis as a subchart

Penpot requires a Redis instance that doesn’t use authentication. When you deploy the Redis subchart, its authentication setting is automatically configured for a one-click installation. The relevant parameters are set in Penpot’s `values.yaml` file as follows:


```
# Redis configuration (Check for [more parameters here](https://apps.rancher.io/applications/redis))
redis:
  auth:
    # -- Whether to enable password authentication.
    enabled: false
```


Since the above configuration is set by default, we only need to enable the Redis subchart for deployment:


```
helm install <release-name> oci://dp.apps.rancher.io/charts/penpot \
    --set global.imagePullSecrets={application-collection} \
    --set global.redisEnabled=true
```


#### Using an external Redis instance

In this example, we will deploy a Redis chart prior to the Penpot deployment. As we are using our custom Redis chart (also employed as a subchart), we have already covered the necessary configuration. To better simulate a production environment, we will install our Redis chart in a separate namespace:


```
helm install redis oci://dp.apps.rancher.io/charts/redis -n redis-dev \
    --set global.imagePullSecrets={application-collection} \
    --set auth.enabled=false
```


Once Redis is running, we need to configure our Penpot chart to connect to the PostgreSQL service. Note this is necessary even when installing everything in a single namespace:


```
helm install <release-name> oci://dp.apps.rancher.io/charts/penpot \
    --set global.imagePullSecrets={application-collection} \
    --set config.redis.host=redis.redis-dev.svc.cluster.local
```


## Operations

### Deploy the chart in Rancher Manager

As a prerequisite, you’ll need to set up your Rancher Manager instance to use the [Application Collection as an OCI registry](../../howto-guides/integrate-with-rancher-manager/index.html#set-up-the-oci-registry) and [configure its credentials](../../howto-guides/integrate-with-rancher-manager/index.html#configure-the-imagepullsecret). These steps are explained in the linked how-to guide, so let’s proceed directly to deploying our Penpot chart:

1.  Go to your local cluster and navigate to Apps → Charts.

2.  Filter the results by `application-collection` and search for “penpot.”

3.  Configure only the following parameters:

    

    ```
    global:
      # -- Global override for container image registry pull secrets
      imagePullSecrets: ["application-collection"]
      # -- Whether to deploy the Application Collection PostgreSQL chart as subchart.
      postgresqlEnabled: true
      # -- Whether to deploy the Application Collection Redis chart as subchart.
      redisEnabled: true
    ```

    

4.  Click Install without modifying any other parameter.

This action installs the Penpot chart along with its Redis and PostgreSQL subcharts, which are pre-enabled for ease of use by default within Rancher Manager.

### Deploy the chart in Rancher Desktop

Similar to using Rancher Manager, Penpot can also be installed via the Application Collection extension available in Rancher Desktop and Docker Desktop. For a step-by-step guide on how to deploy Penpot in Rancher Desktop, please refer to [this blog post](https://www.suse.com/c/rancher_blog/unlocking-developer-productivity-suse-application-collection-extension-for-rancher-desktop/).

### Uninstall the chart

Removing an installed Penpot instance is simple:


```
helm uninstall <release-name>
```


When you are ready to remove the PVCs and their data, you will need to explicitly delete them:


```
kubectl delete pvc --selector app.kubernetes.io/instance=<release-name>
```


> Remember to uninstall any Penpot external dependency deployed during this guide.


Last modified July 22, 2025


