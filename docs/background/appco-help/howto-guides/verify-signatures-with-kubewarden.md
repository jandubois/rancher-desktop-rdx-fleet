---
description: Learn how to verify signatures with Kubewarden
lang: en
robots: index, follow
title: Verify signatures with Kubewarden \| SUSE Application Collection
twitter:card: summary
twitter:description: Learn how to verify signatures with Kubewarden
twitter:title: Verify signatures with Kubewarden
viewport: width=device-width,initial-scale=1,shrink-to-fit=no
---


1.  [How-to guides](...md)
2.  Verify signatures with Kubewarden


# Verify signatures with Kubewarden


Learn how to verify signatures with Kubewarden


![Kubewarden Logo](images/howto-guides/logo-horizontal-kubewarden.png "Kubewarden Logo")

In this guide, we will explain how to use [Kubewarden](https://kubewarden.io) to ensure that images from Application Collection are signed and verified before instantiating or updating them in our cluster. Additionally, we will see how to configure Kubewarden to inform us when we have unverified container images already running.

## Prerequisites

- A cluster configured with authentication to Application Collection as listed [here](howto-guides/get-started/authentication/).
- Kubewarden *\>= 1.1.0* (2022-06) installed in the cluster. You can install it through the Rancher Kubewarden UI extension following the steps [here](https://ranchermanager.docs.rancher.com/integrations-in-rancher/rancher-extensions), or install it manually by following the steps [here](https://docs.kubewarden.io/quick-start#installation).
- A deployed Kubewarden [PolicyServer](https://docs.kubewarden.io/quick-start#policyserver) custom resource, such as the one created by the `kubewarden-defaults` Helm chart. Our verifying policy will run on it.
- The signing information for Application Collection. In this case, the [ap-pubkey.pem](https://apps.rancher.io/ap-pubkey.pem).

## Our approach

We will deploy a Kubewarden[ClusterAdmissionPolicy](https://docs.kubewarden.io/quick-start#clusteradmissionpolicy) configured to verify the container signatures across the whole cluster.

The policy checks all `CREATE` and `UPDATE` operations for workload resources (Deployments, Pods, Cronjobs, etc). We will configure it to check for container images coming from Application Collection and verify their signatures. The policy will reject the operation or log it, depending on how it is configured.

Our policy runs in a Kubewarden [PolicyServer](https://docs.kubewarden.io/quick-start#policyserver) (in this example, the default one). Hence, the PolicyServer must be configured with the Application Collection authentication credentials so it can pull the signature layers of the images from Application Collection.

### Create the Secret for the PolicyServer

The PolicyServer we are using needs to be configured, so it can pull the image layers that contain the signatures.

As explained in the [private registries how-to](https://docs.kubewarden.io/howtos/policy-servers/private-registry) of Kubewarden, we need to create a DockerConfig Secret **in the same Namespace of thePolicyServer**.

Let’s do this by instantiating an `application-collection-kw` secret with the same contents as the `application-collection` secret from the Get started’s [Authentication](../../get-started/authentication.md) page. This is a different Secret, and is in the Namespace of the PolicyServer.

For the default PolicyServer, with name `default`, installed via the `kubewarden-defaults` Helm chart under the `kubewarden` namespace, this would be:


```
kubectl create secret docker-registry application-collection-kw -n kubewarden \
    --docker-server=dp.apps.rancher.io \
    --docker-username=<your-username-or-sa-username> \
    --docker-password=<access-token-or-sa-secret>
```


### Configure the PolicyServer to use the namespaced Secret

We need to set the PolicyServer [`spec.imagePullSecret`](https://docs.kubewarden.io/reference/CRDs#policyserverspec) to our secret name, `application-collection-kw`.

If using the PolicyServer `default` from the `kubewarden-defaults` Helm chart, you can configure it by setting the Helm chart values:


```
helm upgrade -i --wait --namespace kubewarden \
    --create-namespace kubewarden-defaults kubewarden/kubewarden-defaults \
    --reuse-values \
    --set policyServer.imagePullSecret=application-collection-kw
```


### Apply the policy

Let’s apply a ClusterAdmissionPolicy making use of the [Verify Image Signatures](https://artifacthub.io/packages/kubewarden/verify-image-signatures/verify-image-signatures) policy. This policy will check all container images from `dp.apps.rancher.io/containers/*` registry. The policy supports OCI registries and artifacts.

We configure the policy settings with the [public key](../verify-signatures-with-cosign.md) from Application Collection (at the time of writing) in the `pubKeys` array as follows:


```
# check-appco-signatures.yml
---
apiVersion: policies.kubewarden.io/v1
kind: ClusterAdmissionPolicy
metadata:
  annotations:
    io.kubewarden.policy.category: Secure supply chain
    io.kubewarden.policy.severity: medium
  name: check-appco-signatures
spec:
  backgroundAudit: true
  mode: protect
  module: ghcr.io/kubewarden/policies/verify-image-signatures:v0.2.9
  mutating: true
  policyServer: default # our desired PolicyServer name to run the policy in
  timeoutSeconds: 30 # default 10 seconds. Increase if needed.
  rules:
    - apiGroups: [""]
      apiVersions: ["v1"]
      resources: ["pods"]
      operations: ["CREATE", "UPDATE"]
    - apiGroups: [""]
      apiVersions: ["v1"]
      resources: ["replicationcontrollers"]
      operations: ["CREATE", "UPDATE"]
    - apiGroups: ["apps"]
      apiVersions: ["v1"]
      resources: ["deployments", "replicasets", "statefulsets", "daemonsets"]
      operations: ["CREATE", "UPDATE"]
    - apiGroups: ["batch"]
      apiVersions: ["v1"]
      resources: ["jobs", "cronjobs"]
      operations: ["CREATE", "UPDATE"]
  settings:
    modifyImagesWithDigest: true # mutate the request and use the digest instead of tag
    rule: PublicKey
    signatures:
      - image: dp.apps.rancher.io/containers/*
        pubKeys:
          # this array is an AND, not an OR.
          - |-
            -----BEGIN PUBLIC KEY-----
            MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA02FtEt5gBywiyxbmkVsb
            CujcBg5lur0kpEbfDk10gCcs9shVEqEO3ZsOXHursgoaDAWqdPtsYhsgczGeJz9w
            Aw+r6BuRV8YOkE37A8s/7IOQUW0tlqtnt11OKhIiZ9+e5l3ed2H1ymKQO3dgreSy
            rShqYdA3hrItswyp41ApF6zhjSPlR6lAmq3X4wMYLAPptmzfxigTnR4hxB5UNPhs
            i2qA4vLrUM/i+NohECuLr1EAymvupH26HLEdM+eZnlQn+WbhIP5Grc4ba7XrBv7K
            kywgTC7CxkiJZR0mUcUD2wTX/Je8Ewj6oPSalx09e2jtzvmU5Kr9XUyMF7Zsj5CA
            IwIDAQAB
            -----END PUBLIC KEY-----
```


> If you want the policy to reject unverified images, set its [`spec.mode`](https://docs.kubewarden.io/reference/CRDs#clusteradmissionpolicyspec) to `protect`. If you want it to merely monitor and log violations, set its `spec.mode` to `monitor`. See Kubewarden’s [Audit Scanner](https://docs.kubewarden.io/explanations/audit-scanner) docs for more info on running periodic checks and obtaining reports.
>
> It is recommended to set the policy’s [`settings.modifyImagesWithDigest`](https://artifacthub.io/packages/kubewarden/verify-image-signatures/verify-image-signatures#description) and `spec.mutating` to `true` . This configures the policy to mutate the resources of validated images to use the image digest instead of the tag, so the specific image can’t change (as image tags could be changed in the future).

Now, we deploy the policy:


```
kubectl apply -f check-appco-signatures.yml
kubectl get admissionpolicies -n default # wait for status "active"
```


### A quick check

To test it, deploy a Pod with a signed image from Application Collection:


```
$ kubectl run nginx \
    --image dp.apps.rancher.io/containers/nginx:1.24.0 \
    --overrides='{"spec": {"imagePullSecrets":[{"name": "application-collection"}]}}'
pod/nginx created
```


> On the first policy call for a specific image tag, the policy server downloads the needed image layers to verify the signatures (subsequent calls will use the cache). Depending on your machine and connection, the first policy call may run into timeouts. If so, increase the policy [`spec.timeoutSeconds`](https://docs.kubewarden.io/reference/CRDs#clusteradmissionpolicyspec).

You can inspect the logs of your policy-server Pod to see that the verification took place. Additionally, if you have deployed the Audit Scanner, you can see the periodic [Audit Scanner Reports](https://docs.kubewarden.io/explanations/audit-scanner/policy-reports).

## Other approaches

The approach deployed here is functional and secure, yet Kubernetes Operators may prefer more complex approaches. For example, separating team workloads in namespaces, allowing self-service of Kubewarden policies, setting differing security levels, only monitoring for violations yet not blocking, etc.

These are possible with Kubewarden, have a look at the [project documentation](https://docs.kubewarden.io) for more info.


Last modified July 22, 2025


