---
description: Learn how to install and use MinIO
lang: en
robots: index, follow
title: MinIO \| SUSE Application Collection
twitter:card: summary
twitter:description: Learn how to install and use MinIO
twitter:title: MinIO
viewport: width=device-width,initial-scale=1,shrink-to-fit=no
---


1.  [Reference guides](...md)
2.  MinIO


# MinIO


Learn how to install and use MinIO


![MinIO Logo](images/reference-guides/logo-minio.png "MinIO Logo")

## Get started

[MinIO](https://apps.rancher.io/applications/minio) is a High Performance Object Storage, API compatible with Amazon S3 cloud storage service. Use MinIO to build high performance infrastructure for machine learning, analytics and application data workloads.

Before exploring the chart characteristics, let’s start by deploying the default configuration:


```
helm install <release-name> oci://dp.apps.rancher.io/charts/minio \
    --set global.imagePullSecrets={application-collection}
```


> Please check our [authentication guide](../../get-started/authentication/index.html#kubernetes) if you need to configure Application Collection OCI credentials in your Kubernetes cluster.

## Chart overview

The MinIO Helm chart distributed in Application Collection is based on the [MinIO community Helm chart](https://github.com/minio/minio/tree/master/helm/minio) and adapted to include our best practices. As such, any chart-related documentation provided by upstream will work out of the box with our chart. Additionally to the upstream chart repository, you can check the official MinIO documentation [here](https://min.io/docs/minio/linux/).

By default, the chart will deploy a MinIO cluster in [distributed mode](https://min.io/docs/minio/linux/operations/concepts.html#how-does-a-distributed-minio-deployment-work), adding one [server pool](https://min.io/docs/minio/linux/operations/concepts.html#minio-intro-server-pool) of 16 MinIO servers with a single disk per server of `500Gi` capacity each.

## Chart configuration

To view the supported configuration options and documentation, run:


```
helm show values oci://dp.apps.rancher.io/charts/minio
```


### Distributed mode

As explained earlier, the Helm chart’s default topology configuration consists of a multi node MinIO deployment in “distributed” mode. There are a few variations to this setup that can be effortlessly configured to fit your specific needs via parameters in the `values.yaml` file:


```
## minio mode, i.e. standalone or distributed
mode: distributed ## other supported values are "standalone"

# Number of drives attached to a node
drivesPerNode: 1
# Number of MinIO containers running
replicas: 16
# Number of expanded MinIO clusters
pools: 1
```


As an example, to configure a MinIO cluster of 3 server pools, 4 server nodes each and 2 drives per node, (a total of 24 storage volumes: `3 * 4 * 2 = 24`) you would install the Helm chart providing the following values file (`minio.yaml`):


```
drivesPerNode: 2
replicas: 4
pools: 3
```


```
helm install <release-name> oci://dp.apps.rancher.io/charts/minio \
    --set global.imagePullSecrets={application-collection} \
    --values minio.yaml
```


Or equivalently, as command line flags:


```
helm install <release-name> oci://dp.apps.rancher.io/charts/minio \
    --set global.imagePullSecrets={application-collection} \
    --set drivesPerNode=2,replicas=4,pools=3
```


Refer to the official MinIO documentation to know more about the [supported topologies](https://min.io/docs/minio/linux/operations/concepts.html#what-system-topologies-does-minio-support) and the suitability for different scenarios.

### Stand-alone mode

There is no doubt that deploying a MinIO cluster for a production use case can be demanding regarding hardware requirements. If you just want to get started with MinIO or test and explore its posibilities, you can also use this very same Helm chart in “stand-alone” mode with a single server pool and a single server node.

Low resource requests and dummy root credentials are also specified in the command below for ease of testing:


```
helm install <release-name> oci://dp.apps.rancher.io/charts/minio \
    --set global.imagePullSecrets={application-collection} \
    --set mode=standalone \
    --set persistence.size=5Gi,resources.requests.memory=512Mi \
    --set rootUser=admin,rootPassword=admin123
```


> Please note that, in “stand-alone” mode, the persistent volume created will be removed on uninstallation and your data, such as buckets and storage objects, will be lost.

### Additional configurations

There are certain additional MinIO application settings that can be configured via Helm chart parameters such as adding users, service accounts, policies and buckets.

For example, to add a bucket, you would run the following Helm command:


```
helm upgrade --install <release-name> oci://dp.apps.rancher.io/charts/minio \
    --set global.imagePullSecrets={application-collection} \
    --set buckets[0].name=somebucket,buckets[0].policy=none,bucket[0].purge=false
```


Refer to the MinIO [README.md](https://github.com/minio/minio/tree/master/helm/minio) to know more about these after-install settings.

## Operations

### Upgrade the chart

In general, an in-place upgrade of your MinIO cluster can be performed using the built-in Helm upgrade workflow:


```
helm upgrade <release-name> oci://dp.apps.rancher.io/charts/minio
```


The pods will be upgraded by following the update strategy defined in the `values.yaml` file.

> Be aware that changes from version to version may include breaking changes in MinIO itself or in the Helm chart templates. In other cases, the upgrade process may require additional steps to be performed. Refer to the official documentation [Upgrade a MinIO Deployment](https://min.io/docs/minio/linux/operations/install-deploy-manage/upgrade-minio-deployment.md) and always check the [release notes](https://github.com/minio/minio/releases) before proceeding with an upgrade.

### Uninstall the chart

Removing an installed MinIO Helm chart release is simple:


```
helm uninstall <release-name>
```


In the default “distributed” mode, the MinIO servers are deployed as [StatefulSets](https://kubernetes.io/docs/concepts/workloads/controllers/statefulset/), hence using [Volume Claim Templates](https://kubernetes.io/docs/concepts/workloads/controllers/statefulset/#volume-claim-templates) to store your most precious resource in a MinIO cluster: your data. These PVCs are not directly controlled by Helm and they are not removed when uninstalling the related chart.

When you are ready to remove the PVCs and your data, you will need to explicitly delete them:


```
kubectl delete pvc --selector release=<release-name>
```


Last modified September 9, 2025


