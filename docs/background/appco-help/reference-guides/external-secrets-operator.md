---
description: Learn how to install and use External Secrets Operator
lang: en
robots: index, follow
title: External Secrets Operator \| SUSE Application Collection
twitter:card: summary
twitter:description: Learn how to install and use External Secrets Operator
twitter:title: External Secrets Operator
viewport: width=device-width,initial-scale=1,shrink-to-fit=no
---


1.  [Reference guides](...md)
2.  External Secrets Operator


# External Secrets Operator


Learn how to install and use External Secrets Operator


![External Secrets Operator Logo](images/reference-guides/logo-external-secrets-operator.png "External Secrets Operator Logo")

## Get started

[External Secrets Operator](https://apps.rancher.io/applications/external-secrets-operator) is a Kubernetes operator that focuses on integrating third-party secret management systems to synchronize secrets from external APIs into Kubernetes.

Before getting into the chart’s possibilities, let’s start by deploying the default configuration:


```
helm install <release-name> oci://dp.apps.rancher.io/charts/external-secrets-operator
    --set global.imagePullSecrets={application-collection}
```


> Check our [authentication guide](../../get-started/authentication/index.html#kubernetes) if you need to configure Application Collection OCI credentials in your Kubernetes cluster.

## Chart overview

Our External Secrets Operator chart is based on the official [external-secrets chart](https://github.com/external-secrets/external-secrets/tree/main/deploy/charts/external-secrets) and adapted to include our best practices. As such, any chart-related documentation provided by upstream will work out of the box with our chart. You can check the official documentation [here](https://external-secrets.io/latest/).

By default, the chart will install the optional `Core Controller` and `Webhook` components and the related CRDs.

## Chart configuration

To view the supported configuration options and documentation, run:


```
helm show values oci://dp.apps.rancher.io/charts/external-secrets-operator
```


### Configure a provider

External Secrets Operator offers a wide selection of secret management providers. We will use AWS Secrets Manager for the provider, though other providers require similar configurations. You can check the list of available providers and the supported features [here](https://external-secrets.io/latest/introduction/stability-support/).

Before deploying External Secrets Operator’s `SecretStore` and `ExternalSecret` custom resources, we will start by creating a secret in AWS Secrets Manager. This secret will be defined as `aws-test-secret` and will contain the following key/value pairs:


```
{
  "username": "eso_username",
  "password": "ZXNvX3Bhc3N3b3JkCg=="
}
```


To access the above secret, External Secrets Operator will need AWS credentials. These credentials should be provided via a Kubernetes secret. Assuming the credentials are already available locally, the secret can be created using environment variables:


```
$ kubectl create secret generic aws-credentials-secret \
    --from-literal=access-key=$AWS_ACCESS_KEY_ID \
    --from-literal=secret-access-key=$AWS_SECRET_ACCESS_KEY \
    --from-literal=session-token-key=$AWS_SESSION_TOKEN
```


The first resource to deploy is the `SecretStore`. The `SecretStore` is namespaced and specifies how to access the external API. The `SecretStore` maps to exactly one instance of an external API.


```
## aws_secretStore.yaml
apiVersion: external-secrets.io/v1
kind: SecretStore
metadata:
  name: aws-secretstore
spec:
  provider:
    aws:
      service: SecretsManager
      region: eu-north-1
      # defines the information necessary to authenticate against
      # AWS by getting the accessKeyID and secretAccessKey from an
      # already created Kubernetes Secret
      auth:
        secretRef:
          accessKeyIDSecretRef:
            name: aws-credentials-secret
            key: access-key
          secretAccessKeySecretRef:
            name: aws-credentials-secret
            key: secret-access-key
          # required when using temporary security credentials
          sessionTokenSecretRef:
            name: aws-credentials-secret
            key: session-token-key
```


You can check the store has been successfully validated in the resource events:


```
$ kubectl apply -f aws_secretStore.yaml
secretstore.external-secrets.io/aws-secretstore created
$ kubectl get events
LAST SEEN   TYPE      REASON                  OBJECT                        MESSAGE
5m25s       Normal    Valid                   secretstore/aws-secretstore   store validated
```


Once validated, we can deploy the `ExternalSecret` resource. The `ExternalSecret` describes what data should be fetched, how the data should be transformed and saved as a `Kind=Secret`


```
## aws_externalSecret.yaml
apiVersion: external-secrets.io/v1
kind: ExternalSecret
metadata:
  name: aws-externalsecret
  # labels and annotations are copied over to the secret that
  # will be created
  labels:
    test-by: "application-collection"
spec:
  refreshInterval: 1h
  # SecretStore to use when fetching the secret data.
  secretStoreRef:
    name: aws-secretstore
    kind: SecretStore
  # the target describes the secret that shall be created
  # there can only be one target per ExternalSecret
  target:
    name: k8s-aws-secret
  # defines the connection between the Kubernetes Secret
  # keys and the Provider data. Use spec.data to explicitly
  # sync individual keys
  data:
  - secretKey: aws-username
    remoteRef:
      key: aws-test-secret
      property: username
  - secretKey: aws-password
    remoteRef:
      key: aws-test-secret
      property: password
      decodingStrategy: Base64
```


```
$ kubectl apply -f aws_externalSecret.yaml
externalsecret.external-secrets.io/aws-externalsecret created
$ kubectl get events
LAST SEEN   TYPE      REASON                  OBJECT                              MESSAGE
...
3m41s       Normal    Created                 externalsecret/aws-externalsecret   secret created
```


You can now check there is indeed a `k8s-aws-secret` which contains the `aws-username` and `aws-password` keys storing the AWS secret values:


```
$ kubectl describe secret k8s-aws-secret
Name:         k8s-aws-secret
Namespace:    default
Labels:       test-by=application-collection
Type:  Opaque

Data
====
aws-username:  12 bytes
aws-password:  13 bytes
```


> For demonstration purposes we avoided using most of the optional features. You can check the official [API documentation](https://external-secrets.io/latest/api/components/) for the full specification.

## Operations

### Use cert-manager with the webhook component

You can optionally use [cert-manager](https://apps.rancher.io/applications/cert-manager) to issue and renew the webhook certificate. Before this you need to have cert-manager installed in your cluster, which you can do so from Application Collection:


```
helm install <release-name> oci://dp.apps.rancher.io/charts/cert-manager -n cert-manager --create-namespace \
    --set crds.enabled=true \
    --set global.imagePullSecrets={application-collection}
```


Once installed, you can upgrade your External Secrets Operator chart to start using cert-manager:


```
helm upgrade --install <release-name> oci://dp.apps.rancher.io/charts/external-secrets-operator
    --set global.imagePullSecrets={application-collection} \
    --set webhook.certManager.enabled=true \
    --set webhook.certManager.addInjectorAnnotations=true
```


### Uninstall the chart

Removing an installed External Secrets Operator instance is simple:


```
helm uninstall <release-name>
```


> Remember to remove any AWS resource you deployed during this guide.


Last modified September 9, 2025


