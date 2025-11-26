---
description: Configure a NeuVector Admission Control to ensure only images signed by Application Collection are deployed to the cluster.
lang: en
robots: index, follow
title: Verify signatures with NeuVector \| SUSE Application Collection
twitter:card: summary
twitter:description: Configure a NeuVector Admission Control to ensure only images signed by Application Collection are deployed to the cluster.
twitter:title: Verify signatures with NeuVector
viewport: width=device-width,initial-scale=1,shrink-to-fit=no
---


1.  [How-to guides](...md)
2.  Verify signatures with NeuVector


# Verify signatures with NeuVector


Configure a NeuVector Admission Control to ensure only images signed by Application Collection are deployed to the cluster.


All Application Collection OCI artifacts, including container images, Helm charts and OCI attestations, are signed with [*sigstore*](https://www.sigstore.dev/).

This guide will describe the steps to enable an Admission Control Policy for Application Collection using NeuVector, to prevent unsigned image deployments on Kubernetes, guaranteeing their authenticity and integrity.

## Prerequisites

- A running instance of [NeuVector](https://www.suse.com/products/neuvector/). If you just want to follow this guide, we recommend installing
- the [NeuVector Helm chart](https://github.com/neuvector/neuvector-helm) in your local Rancher Desktop Kubernetes cluster.
- Place the public key for Application Collection artifacts in a known path: [ap-pubkey.pem](https://apps.rancher.io/ap-pubkey.pem).

## Create a Sigstore Verifier

In your NeuVector instance, go to `Assets` → `Sigstore Verifiers`. In the *Verifiers* box (the second box from the top), click on `Add`. Enter the following values:

- **Name**: *application-collection*
- **Comment**: *Public sigstore key for Application Collection*
- **Verifier Type**: *keypair*
- **Public Key**: Copy the contents of the public key for Application Collection artifacts ([ap-pubkey.pem](https://apps.rancher.io/ap-pubkey.pem))

> If you don’t find any Sigstore Root of Trust, create a Public one with your name of choice.

![Add Sigstore Verifier form](images/howto-guides/neuvector-add-sigstore-verifier-form.png "Add Sigstore Verifier form")

## Add Application Collection registry

We want to apply policies affecting Application Collection images, but in order for the admission policies to work properly, the images must be scanned beforehand. For that, navigate to `Assets` → `Registries`, and click on `Add`. Enter the following values:

- **Registry type**: *Docker Registry*
- **Name**: *application-collection*
- **Registry**: `https://dp.apps.rancher.io`
- **User Name**: *Your Application Collection username, or a service account username*
- **Password**: *An access token or service account secret*
- **Filter**: *containers/nginx*

After submitting the form, click on `Start Scan` to trigger the registry scan. The *Scan Status* will switch to *Scanning*.

![Application Collection registry](images/howto-guides/neuvector-appcol-registry.png "Application Collection registry")

> **A production-ready setup requires configuring `*` for *Filter* and a service account with proper rate limits.** We use `containers/nginx` just for demonstration purposes, and to avoid hitting rate limits in local development environments.

## Create an Admission Policy

Go to `Policy` → `Admission Control` in your NeuVector instance, and click on `Add` to add a new Admission Control for NeuVector. Enter the following values:

- **Type**: *Deny*
- **Comment**: *Deny images not signed by Application Collection*
- **Criterion**:
  - *Image Sigstore Verifiers does NOT contain ANY of \[public-root-of-trust/application-collection\]*
- **Mode**: *Use Global Mode*
- **Status**: *Enabled*

![Admission Policy form](images/howto-guides/neuvector-admission-policy-form.png "Admission Policy form")

> Make sure that the global *Status* toggle is enabled.

## Test the Admission Policy

To verify that the admission policy is working as expected, we will try to run an image not signed by Application Collection in the cluster:


```
$ kubectl run nginx-unsigned --image nginx
Error from server: admission webhook "neuvector-validating-admission-webhook.neuvector.svc" denied the request: Creation of Kubernetes Pod is denied.
```


The admission controller didn’t let us create the image as expected. Let’s try now with the Application Collection version of Nginx:


```
$ kubectl run nginx --image dp.apps.rancher.io/containers/nginx:1.26.2 --overrides='{"spec": {"imagePullSecrets":[{"name": "application-collection"}]}}'
pod/nginx created
```


Last modified September 9, 2025


