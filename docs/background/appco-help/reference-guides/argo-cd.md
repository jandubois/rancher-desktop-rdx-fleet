---
description: Learn how to install and use Argo CD
lang: en
robots: index, follow
title: Argo CD \| SUSE Application Collection
twitter:card: summary
twitter:description: Learn how to install and use Argo CD
twitter:title: Argo CD
viewport: width=device-width,initial-scale=1,shrink-to-fit=no
---


1.  [Reference guides](...md)
2.  Argo CD


# Argo CD


Learn how to install and use Argo CD


![Argo CD Logo](images/reference-guides/logo-argo-cd.png "Argo CD Logo")

## Get started

[Argo CD](https://apps.rancher.io/applications/argo-cd) is a declarative, GitOps continuous delivery tool for Kubernetes.

Before exploring the chart characteristics, let’s start by deploying the default configuration:


```
helm install <release-name> oci://dp.apps.rancher.io/charts/argo-cd \
    --set global.imagePullSecrets={application-collection}
```


> Please check our [authentication guide](../../get-started/authentication/index.html#kubernetes) if you need to configure Application Collection OCI credentials in your Kubernetes cluster.

## Chart overview

The Argo CD Helm chart distributed in Application Collection is based on the [Argo CD Helm chart](https://github.com/argoproj/argo-helm/tree/main/charts/argo-cd) and adapted to include our best practices. As such, any chart-related documentation provided by upstream will work out of the box with our chart. Additionally to the upstream chart repository, you can check the [official Argo CD documentation](https://argo-cd.readthedocs.io/).

By default, the chart will deploy [the core components of Argo CD](https://argo-cd.readthedocs.io/en/stable/#architecture): API Server, Repository Server and Application Controller as well as other complementary components such as [Dex](https://apps.rancher.io/applications/dex-idp) and [Redis](https://apps.rancher.io/applications/redis).

The Argo CD controller components handle instances of these Custom Resource Definitions (CRDs):

- [`Application`](https://argo-cd.readthedocs.io/en/stable/operator-manual/declarative-setup/#applications): The `Application` CRD is the Kubernetes resource object representing a deployed application instance in an environment.
- [`ApplicationSet`](https://argo-cd.readthedocs.io/en/stable/operator-manual/applicationset/): The `ApplicationSet` CRD is a higher-level application representation that generates multiple applications based on a set of rules.
- [`AppProject`](https://argo-cd.readthedocs.io/en/stable/operator-manual/declarative-setup/#projects): The `AppProject` CRD is the Kubernetes resource object representing a logical grouping of applications.

Check them by running `kubectl api-resources --api-group=argoproj.io`.

## Chart configuration

To view the supported configuration options and documentation, run:


```
helm show values oci://dp.apps.rancher.io/charts/argo-cd
```


### Custom Resource Definitions

The Helm chart installs the Custom Resource Definitions (CRDs) listed in [the section above](index.html#chart-overview). It is possible to disable the installation by passing the `crds.install=false` Helm chart parameter:


```
## Custom resource configuration
crds:
  # -- Install and upgrade CRDs
  install: true
  # -- Keep CRDs on chart uninstall
  keep: true
```


This is useful to manage the CRDs outside the chart or, for some reason, you want to install multiple Argo CD releases on the same Kubernetes cluster:


```
helm install <release-name> oci://dp.apps.rancher.io/charts/argo-cd \
    --set global.imagePullSecrets={application-collection} \
    --set crds.install=false
```


Whether the CRDs are deleted on Helm chart uninstallation can be controlled as well. By default, the CRDs are kept. To modify that behavior, `crds.keep=false` can be provided to modify the default values:


```
helm install <release-name> oci://dp.apps.rancher.io/charts/argo-cd \
    --set global.imagePullSecrets={application-collection} \
    --set crds.keep=false
```


Read more on this topic [here](https://github.com/argoproj/argo-helm/tree/main/charts/argo-cd#custom-resource-definitions).

### Scale Argo CD

Argo CD can be deployed in HA Mode. You can read the official documentation on [High Availability](https://argo-cd.readthedocs.io/en/stable/operator-manual/high_availability/) to have a better understanding on this topic. Each of the components can be scaled horizontally via the `replicas` Helm chart parameter. Additionally, the API Server and Repository Server support Horizontal Pod Autoscaler (HPA) via the `autoscaling.*` Helm chart parameters. [Redis](https://apps.rancher.io/applications/redis) is by default deployed as a standalone pod but it is also possible to install it as a subchart via the `redis-ha.*` parameters deploying multiple nodes in *Sentinel* mode:


```
## Application controller
controller:
  # -- The number of application controller pods to run.
  # Additional replicas will cause sharding of managed clusters across number of replicas.
  ## With dynamic cluster distribution turned on, sharding of the clusters will gracefully
  ## rebalance if the number of replica's changes or one becomes unhealthy. (alpha)
  replicas: 1

## Server
server:
  # -- The number of server pods to run
  replicas: 1
  ## Argo CD server Horizontal Pod Autoscaler
  autoscaling:
    # -- Enable Horizontal Pod Autoscaler ([HPA]) for the Argo CD server
    enabled: false

## Repo Server
repoServer:
  # -- The number of repo server pods to run
  replicas: 1
  ## Repo server Horizontal Pod Autoscaler
  autoscaling:
    # -- Enable Horizontal Pod Autoscaler ([HPA]) for the repo server
    enabled: false

## ApplicationSet controller
applicationSet:
  # -- The number of ApplicationSet controller pods to run
  replicas: 1

## Redis subchart with HA replaces custom redis deployment when `redis-ha.enabled=true`
redis-ha:
  # -- Enables the Redis HA subchart and disables the custom Redis single node deployment
  enabled: false
```


As an example, to deploy three replicas for each of the Argo CD components, configure autoscaling for the API Server and run Redis in Sentinel mode, you would pass the following values file (`ha.yaml`):


```
controller:
  replicas: 3

server:
  autoscaling:
    enabled: false

repoServer:
  replicas: 3

applicationSet:
  replicas: 3

redis-ha:
  enabled: true
```


```
helm install <release-name> oci://dp.apps.rancher.io/charts/argo-cd \
    --set global.imagePullSecrets={application-collection} \
    --values ha.yaml
```


Or equivalently, as command line flags:


```
helm install <release-name> oci://dp.apps.rancher.io/charts/argo-cd \
    --set global.imagePullSecrets={application-collection} \
    --set controller.replicas=3 \
    --set server.autoscaling.enabled=true \
    --set repoServer.replicas=3 \
    --set applicationSet.replicas=3 \
    --set redis-ha.enabled=true
```


After the nodes are initialized, you can see how the deployments and statefulsets are deployed:


```
$ kubectl get deployments,statefulsets --selector app.kubernetes.io/instance=<release-name>
NAME                                                              READY   UP-TO-DATE   AVAILABLE   AGE
deployment.apps/<release-name>-argocd-applicationset-controller   3/3     3            3           64s
deployment.apps/<release-name>-argocd-dex-server                  1/1     1            1           64s
deployment.apps/<release-name>-argocd-notifications-controller    1/1     1            1           64s
deployment.apps/<release-name>-argocd-repo-server                 3/3     3            3           64s
deployment.apps/<release-name>-argocd-server                      1/1     1            1           64s

NAME                                                            READY   AGE
statefulset.apps/<release-name>-argocd-application-controller   3/3     64s
statefulset.apps/<release-name>-redis-ha                        3/3     64s
statefulset.apps/<release-name>-redis-ha-sentinel               3/3     64s
```


### Credentials

The login credentials for Argo CD are randomly generated if not provided. The username is `admin` and the password is stored in a Kubernetes secret created by Argo CD in the Argo CD namespace. It can be revealed by running the following command:


```
kubectl get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d
```


Once the password is revealed, you can delete the Kubernetes secret as explained in the official [Getting Started guide](https://argo-cd.readthedocs.io/en/stable/getting_started/#4-login-using-the-cli).

Alternatively, the `admin` password, bcrypt hashed, can be provided via Helm chart parameters:


```
## Argo Configs
configs:
  # Argo CD sensitive data
  # Ref: https://argo-cd.readthedocs.io/en/stable/operator-manual/user-management/#sensitive-data-and-sso-client-secrets
  secret:
    # -- Create the argocd-secret
    createSecret: true
    # -- Bcrypt hashed admin password
    ## Argo expects the password in the secret to be bcrypt hashed. You can create this hash with
    ## `htpasswd -nbBC 10 "" $ARGO_PWD | tr -d ':\n' | sed 's/$2y/$2a/'`
    argocdServerAdminPassword: ""
```


### Access the web interface

The server UI, a web application interface, is integrated in the API Server component and exposed with a Kubernetes service. There are many options to accessing the service as explained in the official [Getting Started](https://argo-cd.readthedocs.io/en/stable/getting_started/#3-access-the-argo-cd-api-server) guide. This section, as an example, explains how to get the access via Kubernetes ingress. There are a few groups of Helm chart parameters involved. The default values are:


```
global:
  # -- Default domain used by all components
  ## Used for ingresses, certificates, SSO, notifications, etc.
  domain: argocd.example.com

## Server
server:
  # TLS certificate configuration via cert-manager
  ## Ref: https://argo-cd.readthedocs.io/en/stable/operator-manual/tls/#tls-certificates-used-by-argocd-server
  certificate:
    # -- Deploy a Certificate resource (requires cert-manager)
    enabled: false
  # Argo CD server ingress configuration
  ingress:
    # -- Enable an ingress resource for the Argo CD server
    enabled: false
```


> An ingress controller needs to be already deployed and configured in your Kubernetes cluster and the domain should point to the ingress load balancer.

The following values file (`ingress.yaml`) can be used to get the access via Kubernetes ingress with SSL termination at the ingress:


```
configs:
  params:
    server.insecure: true

server:
  ingress:
    enabled: true
```


```
helm install <release-name> oci://dp.apps.rancher.io/charts/argo-cd \
    --set global.imagePullSecrets={application-collection} \
    --values ingress.yaml
```


Or equivalently, as command line flags:


```
helm install <release-name> oci://dp.apps.rancher.io/charts/argo-cd \
    --set global.imagePullSecrets={application-collection} \
    --set configs.params."server\.insecure"=true \
    --set server.ingress.enabled=true
```


Now the Argo CD web interface can be accessed through the ingress load balancer at [argocd.example.com](https://argocd.example.com). Refer to the [Credentials](index.html#credentials) section above to know how to obtain the login credentials.

### Metrics

The Argo CD components can expose Prometheus metrics to be scraped by a Prometheus server. The metrics are disabled by default but it can be enabled via `metrics.enabled` Helm chart parameter for each of the components. As an example, to enable metrics for the Application controller component, the following values file (`metrics.yaml`) can be used:


```
controller:
  metrics:
    enabled: true
```


```
helm install <release-name> oci://dp.apps.rancher.io/charts/argo-cd \
    --set global.imagePullSecrets={application-collection} \
    --values metrics.yaml
```


Or equivalently, as command line flags:


```
helm install <release-name> oci://dp.apps.rancher.io/charts/argo-cd \
    --set global.imagePullSecrets={application-collection} \
    --set controller.metrics.enabled=true
```


Prometheus metrics can be scraped now:


```
$ kubectl port-forward svc/<release-name>-argocd-application-controller-metrics 8082

$ curl -s localhost:8082/metrics | grep argocd_kubectl_requests_total
# HELP argocd_kubectl_requests_total Number of kubectl request results
# TYPE argocd_kubectl_requests_total counter
argocd_kubectl_requests_total{code="200",host="10.43.0.1:443",method="GET"} 11
```


## Operations

### Upgrade the chart

In general, an in-place upgrade of your Argo CD installation can be performed using the built-in Helm upgrade workflow:


```
helm upgrade <release-name> oci://dp.apps.rancher.io/charts/argo-cd
```


> Be aware that changes from version to version may include breaking changes in Argo CD itself or in the Helm chart templates. In other cases, the upgrade process may require additional steps to be performed. Refer to the official [release notes](https://github.com/argoproj/argo-cd/releases) and always check the upstream [Helm chart’s changelog](https://github.com/argoproj/argo-helm/tree/main/charts/argo-cd#changelog) before proceeding with an upgrade.

### Uninstall the chart

Removing an installed Argo CD instance is simple:


```
helm uninstall <release-name>
```


Depending on the [Custom Resource Definition](index.html#custom-resource-definitions) configuration you selected on chart installation, you will need to remove those CRDs if they are not needed anymore:


```
kubectl delete customresourcedefinition --selector app.kubernetes.io/part-of=argocd
```


Last modified November 7, 2025


