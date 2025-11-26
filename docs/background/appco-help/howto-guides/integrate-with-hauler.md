---
description: Learn how to add content from Application Collection to a local Hauler store
lang: en
robots: index, follow
title: Integrate with Hauler \| SUSE Application Collection
twitter:card: summary
twitter:description: Learn how to add content from Application Collection to a local Hauler store
twitter:title: Integrate with Hauler
viewport: width=device-width,initial-scale=1,shrink-to-fit=no
---


1.  [How-to guides](...md)
2.  Integrate with Hauler


# Integrate with Hauler


Learn how to add content from Application Collection to a local Hauler store


![Hauler Logo](images/howto-guides/logo-horizontal-hauler.png "Hauler Logo")

In this guide, we will walk through the process of adding content from the Application Collection to a local Hauler store. You will learn to add Helm charts and container images from Application Collection.

> Basic knowledge about [Hauler](https://docs.hauler.dev/docs/intro) is required before following the instructions.

## Prerequisites

- Having created an access token as described in the [Authentication guide](../../get-started/authentication.md)
- A running instance of [Hauler](https://docs.hauler.dev). If you just want to follow this guide, we recommend running the [Hauler container](https://apps.rancher.io/applications/hauler) in [Rancher Desktop](https://rancherdesktop.io).

To run the Hauler container, execute the following command:


```
docker run \
    --interactive \
    --tty \
    --rm \
    --name <container-name> \
    --entrypoint "/bin/bash" \
    -v "$(pwd):/hauler" \
    -w /hauler \
    dp.apps.rancher.io/containers/hauler:1.3.0
```


> We are sharing a volume with the host machine so the exported assets are accessible on the host machine and can be transferred to the air-gapped environment.

Use the following commands inside the Hauler container shell to authenticate against the Application Collection registry.


```
hauler login dp.apps.rancher.io -u USERNAME -p PASSWORD
```


> Remember to replace the *USERNAME* and *PASSWORD* placeholders with the authentication credentials that were created as described in the [Authentication guide](../../get-started/authentication.md).

## Add assets to the store

Hauler’s store supports adding files, container images and Helm charts. In this guide, we’ll only focus on Helm charts and containers, the content served by the Application Collection.

> Information about adding files to the Hauler store is available in the [official documentation](https://docs.hauler.dev/docs/hauler-usage/store/add/file).

### Add a Helm chart to the store

Hauler’s store supports adding a single [Helm chart](https://docs.hauler.dev/docs/1.0.0/guides-references/hauler-content/charts) by passing its name, repository and version to the `hauler store add chart` command. Use the following command inside the Hauler container shell to download the desired Helm chart into your local Hauler store:


```
hauler store add chart alertmanager --repo oci://dp.apps.rancher.io/charts --version 1.27.1
```


> More information about the `hauler store add chart` command is available in the [official documentation](https://docs.hauler.dev/docs/hauler-usage/store/add/chart).

### Add a container image to the store

Hauler’s store supports adding a single [container image](https://docs.hauler.dev/docs/1.0.0/guides-references/hauler-content/images) by passing the `<image>:<version>` to the `hauler store add image` command. Use the following command inside the Hauler container shell to download the desired container image into your local Hauler store:


```
hauler store add image dp.apps.rancher.io/containers/alertmanager:0.28.1
```


> More information about the `hauler store add image` command is available in the [official documentation](https://docs.hauler.dev/docs/hauler-usage/store/add/image).

### Sync a manifest to the store

Hauler’s store supports syncing multiple assets at once by passing a [manifest](https://docs.hauler.dev/docs/1.0.0/guides-references/manifests) to the `hauler store sync` command using the `--filename` flag. Use the following command inside the Hauler container shell to download the Helm charts and container images into your local Hauler store:


```
# v1 manifests
apiVersion: content.hauler.cattle.io/v1
kind: Images
metadata:
  name: images-content-example
spec:
  images:
    - name: dp.apps.rancher.io/containers/grafana:12.2.1
---
apiVersion: content.hauler.cattle.io/v1
kind: Charts
metadata:
  name: charts-content-example
spec:
  charts:
    - name: grafana
      repoURL: oci://dp.apps.rancher.io/charts
      version: 10.1.4
```


```
hauler store sync --filename hauler-manifest.yaml
```


> More information about the `hauler store sync` command is available in the [official documentation](https://docs.hauler.dev/docs/hauler-usage/store/sync).


Last modified November 4, 2025


