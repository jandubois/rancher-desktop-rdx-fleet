---
description: Mirror Application Collection container images and Helm charts with Harbor
lang: en
robots: index, follow
title: Mirror with Harbor \| SUSE Application Collection
twitter:card: summary
twitter:description: Mirror Application Collection container images and Helm charts with Harbor
twitter:title: Mirror with Harbor
viewport: width=device-width,initial-scale=1,shrink-to-fit=no
---


1.  [How-to guides](...md)
2.  Mirror with Harbor


# Mirror with Harbor


Mirror Application Collection container images and Helm charts with Harbor


![Harbor Logo](images/howto-guides/logo-horizontal-harbor.png "Harbor Logo")

Application Collection provides all container images and Helm charts in an OCI-compliant registry that is available through the Internet. In certain cases, such as air-gapped environments, it might be desirable to access those images through a proxy registry, to have a better control of all the network requests involved in the deployment of container images and Helm charts within an organization.

In this guide, we will describe how this problem can be solved using [Harbor](https://goharbor.io/).

## Proxy registries with Harbor

Using Harbor as a proxy registry allows you to restrict all required network requests to Application Collection, except those made by the Harbor instance to proxy the container images and Helm charts. This way, only the Harbor instance would require network access to Application Collection in an organization’s network.

Harbor supports two different methods to provide container images and Helm charts through a proxy registry:

- **Proxy Cache registry**: A Proxy Cache registry is a type of registry that caches all the OCI artifacts, namely, container images and Helm charts, from a target registry to the local Harbor instance in real-time.
- **Replication rules**: A replication rule allows you to replicate a set of OCI artifacts, namely, container images and Helm charts, from a source registry to a target registry (such as from Application Collection to the local Harbor instance).

### As a Proxy Cache

A proxy cache can be used to pull images from a target registry into an environment with limited or no access to the internet. You can also use a proxy cache to limit the amount of requests made to a public registry, avoiding consuming too much bandwidth or being throttled by the registry server.

> As of Harbor v2.1.1, the proxy cache feature was updated to support rate limit policies. If you plan to use proxy cache, it is strongly recommended that you use v2.1.1 or later to avoid being rate limited.

Before creating a proxy cache project, it is necessary to create a registry endpoint for Application Collection. In your Harbor instance, go to the sidebar and select `Registries` → `New endpoint`. Enter the following fields and click `OK`:

- **Provider**: *Docker Registry*
- **Name**: *application-collection*
- **Endpoint URL**: `https://dp.apps.rancher.io`
- **Access ID**: A [service account](../../get-started/authentication/index.html#create-a-service-account) username
- **Access Secret**: The service account secret
- **Verify Remote Cert**: *Enabled*
- Optionally, click `Test Connection` to verify the credentials

![Create Harbor endpoint](images/howto-guides/mirror-harbor-endpoint.png "Create Harbor endpoint")

Then, go to the sidebar and select `Projects` → `New Project`. Enter the following fields:

- **Project Name**: *application-collection*. This value will determine the URI prefix under which the OCI artifacts will be available through the Harbor registry.
- **Proxy Cache**: *Enabled*. Select the *application-collection* registry that was created previously.

![Create Harbor Proxy Cache project](images/howto-guides/mirror-harbor-proxy-cache-project.png "Create Harbor Proxy Cache project")

Harbor will now be configured to act as a Proxy Cache for Application Collection.

#### Pull a container image

To test the Proxy Cache configuration, you can pull a container image from Application Collection to verify that it works as expected.

For example, if your Harbor is living under the *core.harbor.domain* domain and the Harbor project’s name is *application-collection*, the following command would allow you to pull the container image `dp.apps.rancher.io/containers/etcd:3.5.14-7.7`:


```
docker pull core.harbor.domain/application-collection/containers/etcd:3.5.14-7.7
```


#### Deploy a Helm chart

You can also test the Proxy Cache configuration by deploying a Helm chart from Application Collection to verify that it works as expected.

For example, if your Harbor is living under the *core.harbor.domain* domain and the Harbor project’s name is *application-collection*, the following command would allow you to deploy the Application Collection etcd Helm chart from `oci://core.harbor.domain/application-collection/charts/etcd`:


```
helm install RELEASE-NAME oci://core.harbor.domain/application-collection/charts/etcd \
    --set global.imageRegistry=core.harbor.domain/application-collection \
    --set global.imagePullSecrets={application-collection}
```


### With replication rules

Before creating a replication rule, a registry endpoint for Application Collection must exist. In order to create it, go to the sidebar of your Harbor instance and select `Registries` → `New endpoint`. Enter the following fields and click `OK`:

- **Provider**: *Docker Registry*
- **Name**: *application-collection*
- **Endpoint URL**: *<https://dp.apps.rancher.io>*
- **Access ID**: A [service account](../../get-started/authentication/index.html#create-a-service-account) username
- **Access Secret**: The service account secret
- **Verify Remote Cert**: *Enabled*
- Optionally, click `Test Connection` to verify the credentials

![Create Harbor endpoint](images/howto-guides/mirror-harbor-endpoint.png "Create Harbor endpoint")

Then, go to the sidebar and select `Replications` → `New Replication Rule`. Enter at least the following fields and click `Save`:

- **Name**: *application-collection*
- **Replication mode**: *Pull-based*
- **Source registry**: *application-collection*
- **Source resource filter**:
  - **Name**: For all OCI artifacts, enter `**`. For a specific OCI artifact, enter the path of the image, for example: `containers/etcd` for the container images of etcd, `charts/etcd` for the Helm charts, or `**/etcd` for both.
  - **Tag**: For all tags, enter `**`. For a specific tag pattern, enter the pattern directly.
- **Destination**:
  - **Namespace**: *application-collection*
  - **Flattening**: *No Flatting*
- **Bandwidth**: Configures the maximum bandwidth for each replication task. This limit is defined in Kbps, with -1 standing for unlimited bandwidth (which is not recommended).

Given the high number of OCI artifacts available in Application Collection, the initial replication can lead to a very high activity. In order to mitigate this, it is recommended to control what are the OCI artifacts being replicated and at which bandwidth it is done.

- **The source filter should be properly constrained**. A Harbor replication rule where the source filter is not properly configured may be a costly operation regarding disk and network usage. Additionally, it could lead to hitting Application Collection’s rate limits and hence receiving `HTTP 429 Too Many Requests` errors. For this reason, we recommend to configure the filter to only synchronize the necessary artifacts and tags.

- **Set a proper bandwidth limit**. This will ensure that the replication is done in a smooth and reliable way.

  > When configuring your bandwidth limit, please be mindful that setting it to a very low value can lead to a known [issue](https://github.com/goharbor/harbor/issues/15708) If a replication job with a slow limit is stopped, the worker may take a considerable amount of time to become available again for new tasks.

![Create Harbor replication rule](images/howto-guides/mirror-harbor-replication-rule.png "Create Harbor replication rule")

Once created, force a replication by selecting the newly created replication rule, and click `Replicate`. In `Executions`, you can view the progress and logs of the replication.

When the replication succeeds, the replicated OCI artifacts, namely, container images and Helm charts, will be available for use.

#### Pull a container image

To test the replication rules configurations, you can pull a replicated container image from Application Collection to verify that it works as expected.

For example, if your Harbor is living under the *core.harbor.domain* domain and the Harbor project’s name is *application-collection*, the following command would allow you to pull the container image `core.harbor.domain/application-collection/containers/etcd:3.5.14-7.7`:


```
docker pull core.harbor.domain/application-collection/containers/etcd:3.5.14-7.7
```


#### Deploy a Helm chart

You can also test the replication rules configuration by deploying a replicated Helm chart from Application Collection to verify that it works as expected.

For example, if your Harbor is living under the *core.harbor.domain* domain and the Harbor project’s name is *application-collection*, the following command would allow you to deploy the Application Collection etcd Helm chart from `oci://core.harbor.domain/application-collection/charts/etcd`:


```
helm install RELEASE-NAME oci://core.harbor.domain/application-collection/charts/etcd \
    --set global.imageRegistry=core.harbor.domain/application-collection \
    --set global.imagePullSecrets={application-collection}
```


Last modified July 10, 2025


