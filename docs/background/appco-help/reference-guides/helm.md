---
description: Learn how to run and use Helm
lang: en
robots: index, follow
title: Helm \| SUSE Application Collection
twitter:card: summary
twitter:description: Learn how to run and use Helm
twitter:title: Helm
viewport: width=device-width,initial-scale=1,shrink-to-fit=no
---


1.  [Reference guides](...md)
2.  Helm


# Helm


Learn how to run and use Helm


![Helm Logo](images/reference-guides/logo-helm.png "Helm Logo")

## Get started

[Helm](https://apps.rancher.io/applications/helm) is a tool for managing Charts. Charts are packages of pre-configured Kubernetes resources.

Before exploring the container’s possibilities, let’s start by deploying the default configuration:


```
docker run \
    --interactive \
    --tty \
    --rm \
    --name <container-name> \
    dp.apps.rancher.io/containers/helm:4.0.0
```


> Check our [authentication guide](../../get-started/authentication/index.html#kubernetes) if you need to configure Application Collection OCI credentials in your Docker client.

## Container overview

Since there is no official upstream container for Helm, our container is built from scratch using a SUSE Linux BCI Micro base image and following our best practices.

## Deploy a Helm chart from Application Collection

To run the Helm container, execute the following command:


```
docker run \
    --interactive \
    --tty \
    --rm \
    --name <container-name> \
    --network host \
    --entrypoint "/bin/bash" \
    --volume ~/.kube/config:/.kube/config:ro \
    --env KUBECONFIG=/.kube/config \
    dp.apps.rancher.io/containers/helm:4.0.0
```


> We shared the host’s kubeconfig file and set the `KUBECONFIG` environment variable as required by the Helm CLI to authenticate and reach your Kubernetes clusters. We also shared the host’s network to ensure the Helm container can communicate with the cluster’s API server.

Before demonstrating how to deploy a Helm chart from the Application Collection, we need to authenticate against the Application Collection OCI registry.

Run the following command inside the Helm container shell to authenticate:


```
helm registry login dp.apps.rancher.io -u USERNAME -p PASSWORD
```


> Remember to replace the *USERNAME* and *PASSWORD* placeholders with the authentication credentials that were created as described in the [Authentication guide](../../get-started/authentication.md).

### Install a Helm chart

Run the command below inside the Helm container shell to install the Prometheus Helm chart directly from the Application Collection’s OCI registry:


```
helm install prometheus oci://dp.apps.rancher.io/charts/prometheus \
    --set 'global.imagePullSecrets={application-collection}'
```


> More information about the `helm install` command is available in the [official documentation](https://helm.sh/docs/helm/helm_install). Please check our [authentication guide](../../get-started/authentication/index.html#kubernetes) if you need to configure Application Collection OCI credentials in your Kubernetes cluster.

### List Helm releases

Use the following command inside the Helm container shell to list Helm releases in the default namespace and confirm that Prometheus has been deployed successfully:


```
$ helm list
NAME            NAMESPACE       REVISION        UPDATED                                 STATUS          CHART                   APP VERSION
prometheus      default         1               2025-11-05 20:04:41.287106365 +0000 UTC deployed        prometheus-27.44.0      3.7.3
```


> More information about the `helm list` command is available in the [official documentation](https://helm.sh/docs/helm/helm_list).

### Uninstall a Helm chart

Use the following command inside the Helm container shell to uninstall Helm charts and remove the Prometheus release:


```
$ helm uninstall prometheus
release "prometheus" uninstalled
```


Last modified November 17, 2025


