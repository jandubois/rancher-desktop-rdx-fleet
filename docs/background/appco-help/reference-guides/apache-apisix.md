---
description: Learn how to install and use Apache APISIX
lang: en
robots: index, follow
title: Apache APISIX \| SUSE Application Collection
twitter:card: summary
twitter:description: Learn how to install and use Apache APISIX
twitter:title: Apache APISIX
viewport: width=device-width,initial-scale=1,shrink-to-fit=no
---


1.  [Reference guides](...md)
2.  Apache APISIX


# Apache APISIX


Learn how to install and use Apache APISIX


![Apache APISIX Logo](images/reference-guides/logo-apache-apisix.png "Apache APISIX Logo")

## Get started

[Apache APISIX](https://apps.rancher.io/applications/apache-apisix) provides rich traffic management features like load balancing, dynamic upstream, canary release, circuit breaking, authentication, observability, etc.

Before exploring the chart’s possibilities, let’s start by deploying the default configuration:


```
helm install <release-name> oci://dp.apps.rancher.io/charts/apache-apisix \
    --namespace apisix \
    --create-namespace \
    --set global.imagePullSecrets={application-collection}
```


> Check our [authentication guide](../../get-started/authentication/index.html#kubernetes) if you need to configure Application Collection OCI credentials in your Kubernetes cluster.

## Chart overview

Our Apache APISIX chart is based on the official [apache-apisix](https://github.com/apache/apisix-helm-chart/tree/master/charts/apisix) chart and adapted to include our best practices. As such, any chart-related documentation provided by upstream will work out of the box with our chart. You can check the official documentation [here](https://apisix.apache.org/docs/helm-chart/apisix/).

By default, the chart will install the optional `etcd` component.

## Chart configuration

To view the supported configuration options and documentation, run:


```
helm show values oci://dp.apps.rancher.io/charts/apache-apisix
```


### Deploy the dashboard

The Apache APISIX Helm chart offers a dashboard UI that allows you to easily manage its configurations. In order to deploy Apache APISIX with the dashboard UI, run the following command:


```
helm install <release-name> oci://dp.apps.rancher.io/charts/apache-apisix \
    --namespace apisix \
    --create-namespace \
    --set global.imagePullSecrets={application-collection} \
    --set dashboard.enabled=true \
    --set dashboard.config.conf.etcd.endpoints[0]='<release-name>-etcd:2379'
```


### Deploy the ingress controller

To deploy Apache APISIX with the ingress controller, run the following command:


```
helm install <release-name> oci://dp.apps.rancher.io/charts/apache-apisix \
    --namespace apisix \
    --create-namespace \
    --set global.imagePullSecrets={application-collection} \
    --set ingress-controller.enabled=true \
    --set ingress-controller.config.apisix.serviceNamespace=apisix
```


> It is necessary to reference the namespace where the chart is being installed in the `ingress-controller.config.apisix.serviceNamespace` property, so the controllers spun up by the installation know how to reach the Gateway and the Admin API of Apache APISIX.

### External etcd

By default, the Apache APISIX Helm chart is installed with [etcd](https://apps.rancher.io/applications/etcd). However, there are scenarios where you may want to configure Apache APISIX to use an external etcd cluster. This can be modified by installing the Helm chart with the following command:


```
helm install <release-name> oci://dp.apps.rancher.io/charts/apache-apisix \
    --namespace apisix \
    --create-namespace \
    --set global.imagePullSecrets={application-collection} \
    --set etcd.enabled=false \
    --set 'externalEtcd.host[0]=<your-etcd-address>:<your-etcd-port>' \
    --set 'externalEtcd.password=<your-etcd-password>'
```


As the dashboard also requires etcd to work properly, the following command should be used to install our Apache APISIX chart with the dashboard if an external etcd cluster is used:


```
helm install <release-name> oci://dp.apps.rancher.io/charts/apache-apisix \
    --namespace apisix \
    --create-namespace \
    --set global.imagePullSecrets={application-collection} \
    --set etcd.enabled=false \
    --set 'externalEtcd.host[0]=<your-etcd-address>:<your-etcd-port>' \
    --set 'externalEtcd.password=password' \
    --set dashboard.enabled=true \
    --set 'dashboard.config.conf.etcd.endpoints[0]=<your-etcd-address>:<your-etcd-port>' \
    --set 'dashboard.config.conf.etcd.username=<your-etcd-username>' \
    --set 'dashboard.config.conf.etcd.password=<your-etcd-password>'
```


## Operations

### Uninstall the chart

Removing an installed Apache APISIX instance is simple:


```
helm uninstall <release-name> \
    --namespace apisix
```


The `apisix` namespace is not removed by default. If no longer needed, use the following command to delete it:


```
kubectl delete namespace apisix
```


Due to Helm’s [design](https://helm.sh/docs/chart_best_practices/custom_resource_definitions/#some-caveats-and-explanations), CustomResourceDefinitions (CRDs) are not removed when uninstalling the related chart. To do so, you will need to explicitly remove them:


```
kubectl delete $(kubectl get CustomResourceDefinition -l='apisix.apache.org/app=ingress-apisix' -o name -A)
```


Last modified July 10, 2025


