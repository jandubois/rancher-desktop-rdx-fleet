---
description: Learn how to install and use Kiali
lang: en
robots: index, follow
title: Kiali \| SUSE Application Collection
twitter:card: summary
twitter:description: Learn how to install and use Kiali
twitter:title: Kiali
viewport: width=device-width,initial-scale=1,shrink-to-fit=no
---


1.  [Reference guides](...md)
2.  Kiali


# Kiali


Learn how to install and use Kiali


![Kiali Logo](images/reference-guides/logo-kiali.png "Kiali Logo")

## Get started

[Kiali](https://apps.rancher.io/applications/kiali) is an observability console for Istio with service mesh configuration and validation capabilities.

Before getting into the chart’s possibilities, let’s start by deploying the default configuration:


```
helm install <release-name> oci://dp.apps.rancher.io/charts/kiali -n istio-system --create-namespace \
    --set global.imagePullSecrets={application-collection}
```


> Check our [authentication guide](../../get-started/authentication/index.html#kubernetes) if you need to configure Application Collection OCI credentials in your Kubernetes cluster.

## Chart overview

Our Kiali chart is based on the official [kiali-server](https://github.com/kiali/helm-charts/tree/master/kiali-server) chart and improved with our best practices. As such, any chart-related documentation provided by upstream will work out of the box with our chart. You can check the official documentation [here](https://kiali.io/docs/installation/installation-guide/install-with-helm/#standalone-kiali-installation).

## Chart configuration

To view the supported configuration options and documentation, run:


```
helm show values oci://dp.apps.rancher.io/charts/kiali
```


## Kiali dependencies

Kiali depends on external services and components, all of which are provided as charts by Application Collection. The following diagram illustrates the elements involved in Kiali and its interactions:

![Kiali diagram](images/reference-guides/kiali-architecture.png "Kiali architecture")

### Prometheus

By default, [Prometheus](https://apps.rancher.io/applications/prometheus) is an optional dependency for Istio. This changes when configuring Istio to work with Kiali. Kiali communicates directly with Prometheus and assumes the metrics used by Istio Telemetry. It’s a hard dependency for Kiali, and many Kiali features will not work without it.

When Istio Telemetry is enabled, metrics data is stored in Prometheus. Kiali uses the data stored in Prometheus to figure out the mesh topology, show metrics, calculate health, etc.

You can deploy the Prometheus chart from Application Collection:


```
helm install <release-name> oci://dp.apps.rancher.io/charts/prometheus -n istio-system --create-namespace \
    --set global.imagePullSecrets={application-collection}
```


### Istio

Kiali, as an [Istio](https://apps.rancher.io/applications/istio) console focused on providing and controlling the service mesh, requires a running Istio deployment to function.

You can deploy Istio from Application Collection:


```
helm install <release-name> oci://dp.apps.rancher.io/charts/istio -n istio-system --create-namespace \
    --set global.imagePullSecrets={application-collection}
```


> Review Kiali’s [compatibility matrix](https://kiali.io/docs/installation/installation-guide/prerequisites/#version-compatibility) to decide which Istio version you should use.

Istio can control scraping entirely by *prometheus.io* annotations, which allows Istio scraping to work out-of-the-box. Additionally, our Istio chart also merges Prometheus metrics by default to ease its integration with Prometheus. If you are using your own deployment, check [Istio documentation](https://istio.io/latest/docs/ops/integrations/prometheus/) for the best approach to configure this.

### Grafana

[Grafana](https://apps.rancher.io/applications/grafana) is optional, as Kiali has basic metric capabilities. By default, Kiali can show the default Istio metrics for workloads, apps and services. It also allows grouping the provided metrics and fetching metrics for different time ranges. However, Kiali doesn’t allow customizing views or Prometheus queries.

You can install the Grafana chart available in Application Collection with the following command:


```
helm install <release-name> oci://dp.apps.rancher.io/charts/grafana -n istio-system --create-namespace \
    --set global.imagePullSecrets={application-collection}
```


After installing the chart, you will need to add your Prometheus instance as datasource and import any Istio dashboards you may want. You can go to [Istio’s documentation](https://istio.io/latest/docs/ops/integrations/grafana/) to review the different official dashboards.

### Jaeger

[Jaeger](https://apps.rancher.io/applications/jaeger-operator) is optional and requires enabling Istio’s [distributed tracing](https://istio.io/latest/docs/tasks/observability/distributed-tracing/jaeger/). When Jaeger is available, Kiali will direct the user to Jaeger’s tracing data.

Before installing Jaeger, ensure the [cert-manager](https://apps.rancher.io/applications/cert-manager) application is available in your Kubernetes cluster. You can install it using the Application Collection chart:


```
helm install <release-name> oci://dp.apps.rancher.io/charts/cert-manager -n cert-manager --create-namespace \
    --set crds.enabled=true \
    --set global.imagePullSecrets={application-collection}`
```


With `cert-manager` deployed, you can now install Jaeger. In this guide, we will install it via its operator, which you can also find in Application Collection:


```
helm install <release-name> oci://dp.apps.rancher.io/charts/jaeger-operator -n istio-system --create-namespace \
    --set rbac.clusterRole=true \
    --set global.imagePullSecrets={application-collection}
```


Now that we have Jaeger Operator online, we’ll need to deploy a Jaeger app and any related resources:


```
$ kubectl create sa jaeger -n istio-system
serviceaccount/jaeger created
$ kubectl patch serviceaccount -n istio-system jaeger -p '{"imagePullSecrets": [{"name": "application-collection"}]}'
serviceaccount/jaeger patched
```


```
$ kubectl apply -f - <<EOF
apiVersion: jaegertracing.io/v1
kind: Jaeger
metadata:
 name: jaeger-app
 namespace: istio-system
spec:
 serviceAccount: jaeger
EOF

jaeger.jaegertracing.io/jaeger-app created
```


> We are deploying the default deployment strategy, AllInOne, for this guide. You should check the recommended [Production Strategy](https://www.jaegertracing.io/docs/1.65/operator/#production-strategy) for long term storage and HA features.

Our Jaeger application is up & running, but we still need to configure Istio to use distributed tracing. We will first update our Istio chart to use enable distributed tracing.


```
$ cat <<EOF > ./tracing.yaml
istiod:
 meshConfig:
   enableTracing: true
   defaultConfig:
     tracing: {} # disable legacy MeshConfig tracing options
   extensionProviders:
   - name: jaeger
     opentelemetry:
       port: 4317
       service: jaeger-app-collector.istio-system.svc.cluster.local
EOF
```


```
$ helm upgrade istio oci://dp.apps.rancher.io/charts/istio -n istio-system --create-namespace \
    --set global.imagePullSecrets={application-collection} \
    --values tracing.yaml
```


Once our chart is upgraded, we can finish the setup by deploying a `Telemetry` resource for Istio:


```
$ kubectl apply -f - <<EOF
apiVersion: telemetry.istio.io/v1
kind: Telemetry
metadata:
  name: mesh-default
  namespace: istio-system
spec:
  tracing:
  - providers:
    - name: jaeger
EOF
```


## Operations

### Install the chart

You can deploy your Kiali chart once you have Istio configured with a Prometheus instance in your cluster:


```
helm install <release-name> oci://dp.apps.rancher.io/charts/kiali -n istio-system --create-namespace \
    --set global.imagePullSecrets={application-collection} \
    --set external_services.prometheus.custom_metrics_url="http://prometheus-server.istio-system" \
    --set external_services.prometheus.url="http://prometheus-server.istio-system"
```


### Access the UI

Kiali uses the token auth strategy by default. As such, users must log in to Kiali using a service account token. We will create a token using the existing Kiali service account, which means you will log in with the same permissions as that of the Kiali server itself:


```
kubectl -n istio-system create token kiali
```


> We recommended creating different service accounts with diverse permissions for your production environment.

After that, you can easily test your Kiali application by exposing it to your local machine:


```
kubectl port-forward svc/kiali 20001:20001 -n istio-system
```


Once the port forwarding is active, you can go to the Kiali login page and input the previously generated token.

Kiali won’t be accessible externally by default. You can check how to configure the different options [here](https://kiali.io/docs/installation/installation-guide/accessing-kiali/).

### Upgrade Kiali to work with Grafana

Before continuing, ensure you have a running Grafana instance with some Istio dashboards imported as explained in the [Grafana](index.html#grafana) section. After verifying this, we will configure our Kiali chart to connect to Grafana. This can be defined using the `external_services.grafana` parameters as seen below:


```
$ cat <<EOF > ./grafana.yaml
external_services:
  grafana:
    enabled: true
    auth:
      password: "test_pass"
      type: "basic"
      username: "test_user"
    internal_url: "http://grafana.istio-system"
    external_url: "http://grafana.istio-system"
    dashboards:
    - name: "Istio Performance Dashboard"
EOF
```


You can connect Grafana to an already installed Kiali instance by using `helm upgrade`:


```
helm upgrade --install <release-name> oci://dp.apps.rancher.io/charts/kiali -n istio-system --create-namespace \
    --set global.imagePullSecrets={application-collection} \
    --values grafana.yaml
    --reuse-values
```


### Upgrade Kiali to work with Jaeger

Before continuing, ensure you have a running Jaeger instance and that Istio has been properly configured as explained in the [Jaeger](index.html#jaeger) section. After verifying this, we will configure our Kiali chart to connect to Jaeger. This can be defined using the `external_services.tracing` parameters as seen below:


```
$ cat <<EOF > ./jaeger.yaml
external_services:
  tracing:
    use_grpc: true
    internal_url: "http://jaeger-app-query.istio-system:16685/jaeger"
EOF
```


You can connect Jaeger to an already installed Kiali instance by using `helm upgrade`:


```
helm upgrade --install <release-name> oci://dp.apps.rancher.io/charts/kiali -n istio-system --create-namespace \
    --set global.imagePullSecrets={application-collection} \
    --values jaeger.yaml
```


### Uninstall the chart

Removing an installed Kiali instance is simple:


```
helm uninstall <release-name> -n istio-system
```


> Remember to uninstall any Kiali dependency you deployed during this guide.


Last modified July 10, 2025


