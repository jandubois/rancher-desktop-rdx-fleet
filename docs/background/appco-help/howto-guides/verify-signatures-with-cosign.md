---
description: Learn how to verify signatures with Cosign
lang: en
robots: index, follow
title: Verify signatures with Cosign \| SUSE Application Collection
twitter:card: summary
twitter:description: Learn how to verify signatures with Cosign
twitter:title: Verify signatures with Cosign
viewport: width=device-width,initial-scale=1,shrink-to-fit=no
---


1.  [How-to guides](...md)
2.  Verify signatures with Cosign


# Verify signatures with Cosign


Learn how to verify signatures with Cosign


![Cosign Logo](images/howto-guides/logo-horizontal-cosign.png "Cosign Logo")

All Application Collection OCI artifacts, including container images, Helm charts and OCI attestations, are signed with [*sigstore*](https://www.sigstore.dev/).

## Prerequisites

Follow these steps to perform the signature verification for all Application Collection artifacts:

- Download and install the [crane](https://github.com/google/go-containerregistry/tree/main/cmd/crane) tool in your system.
- Optionally, download the public key for Application Collection artifacts and place it in a known path: [ap-pubkey.pem](https://apps.rancher.io/ap-pubkey.pem).

The [cosign](https://docs.sigstore.dev/system_config/installation/) tool can be used to verify the signatures, and you can install it in your system or use a container image. In this guide, the Application Collection [container image for cosign](https://apps.rancher.io/applications/cosign) will be used.

> Remember to replace the *USERNAME* and *PASSWORD* placeholders with the authentication credentials that were created as described in the [Authentication guide](../../get-started/authentication.md).

## Container images

### Multi-arch manifest

To verify the signature of the multi-arch manifest of an Application Collection container image, that is, the manifest that declares the manifests for each supported architecture of the container image, execute the following command:


```
docker run --rm dp.apps.rancher.io/containers/cosign:2 \
    verify dp.apps.rancher.io/containers/IMAGE:TAG \
    --registry-username USERNAME --registry-password PASSWORD
    --key https://apps.rancher.io/ap-pubkey.pem
```


For example, the following command will verify the signature of the Application Collection container image for `etcd 3.5.12`:


```
$ docker run --rm dp.apps.rancher.io/containers/cosign:2 \
    verify dp.apps.rancher.io/containers/etcd:3.5.12 \
    --registry-username USERNAME --registry-password PASSWORD /
    --key https://apps.rancher.io/ap-pubkey.pem

Verification for dp.apps.rancher.io/containers/etcd:3.5.12 --
The following checks were performed on each of these signatures:
  - The cosign claims were validated
  - Existence of the claims in the transparency log was verified offline
  - The signatures were verified against the specified public key

[{"critical":{"identity":{"docker-reference":"dp.apps.rancher.io/containers/etcd"},"image":{"docker-manifest-digest":"sha256:93165ccc4f3e018f0f9cbab36ef0f5e4651faf75d48f8c3b2c8f1933cd88498c"},"type":"cosign container image signature"},"optional":{"creator":"OBS"}}]
```


If you have downloaded [ap-pubkey.pem](https://apps.rancher.io/ap-pubkey.pem) locally, you can use it to verify the signature for container image artifacts:


```
docker run --rm -v ./ap-pubkey.pem:/ap-pubkey.pem:ro \
    dp.apps.rancher.io/containers/cosign:2 \
    verify dp.apps.rancher.io/containers/etcd:3.5.12 \
    --registry-username USERNAME --registry-password PASSWORD \
    --key /ap-pubkey.pem
```


### Single-arch manifest

To verify the signature of the single-arch manifest of an Application Collection container image, that is, the manifest for a container image for a specific architecture, follow these steps:

1.  Obtain the digest of the container image for which you want to obtain the OCI attestation. They are architecture-specific. You can use *crane* to obtain it:

    

    ```
    crane digest --platform linux/ARCHITECTURE dp.apps.rancher.io/containers/IMAGE_NAME:TAG
    ```

    

    For example, to obtain the digest for `etcd 3.5.12` on the `amd64` architecture (also known as `x86_64`), execute the following command:

    

    ```
    $ crane digest --platform linux/amd64 dp.apps.rancher.io/containers/etcd:3.5.12
    sha256:7e4ec052525fad97b54a66801e4c2a11887c0f42a1622148d7234e1164169753
    ```

    

2.  Verify the signature of the manifest for the specific architecture using *cosign*:

    

    ```
    docker run --rm dp.apps.rancher.io/containers/cosign:2 \
        verify dp.apps.rancher.io/containers/IMAGE_NAME@DIGEST \
        --registry-username USERNAME --registry-password PASSWORD \
        --key https://apps.rancher.io/ap-pubkey.pem
    ```

    

    For example, the following command will verify the signature of the Application Collection container image for `etcd 3.5.12` on the `amd64` architecture:

    

    ```
    $ docker run --rm dp.apps.rancher.io/containers/cosign:2 \
        verify dp.apps.rancher.io/containers/etcd@sha256:7e4ec052525fad97b54a66801e4c2a11887c0f42a1622148d7234e1164169753 \
        --registry-username USERNAME --registry-password PASSWORD \
        --key https://apps.rancher.io/ap-pubkey.pem

    Verification for dp.apps.rancher.io/containers/etcd@sha256:7e4ec052525fad97b54a66801e4c2a11887c0f42a1622148d7234e1164169753 --
    The following checks were performed on each of these signatures:
      - The cosign claims were validated
      - Existence of the claims in the transparency log was verified offline
      - The signatures were verified against the specified public key

    [{"critical":{"identity":{"docker-reference":"dp.apps.rancher.io/containers/etcd"},"image":{"docker-manifest-digest":"sha256:7e4ec052525fad97b54a66801e4c2a11887c0f42a1622148d7234e1164169753"},"type":"cosign container image signature"},"optional":{"creator":"OBS"}}]
    ```

    

### OCI attestations

To verify the signature of the OCI attestations attached to a container image, which contain extra metadata and documents such as the SLSA provenance, SBOMs, antivirus scans or vulnerability scans, follow these steps:

1.  Obtain the digest of the container image for which you want to obtain the OCI attestation. They are architecture-specific. You can use *crane* to obtain it:

    

    ```
    crane digest --platform linux/ARCHITECTURE dp.apps.rancher.io/containers/IMAGE_NAME:TAG
    ```

    

    For example, to obtain the digest for `etcd 3.5.12` on the `amd64` architecture (also known as `x86_64`), execute the following command:

    

    ```
    $ crane digest --platform linux/amd64 dp.apps.rancher.io/containers/etcd:3.5.12
    sha256:7e4ec052525fad97b54a66801e4c2a11887c0f42a1622148d7234e1164169753
    ```

    

2.  List the available OCI attestations for the artifact. You can use *cosign* to list available OCI attestations:

    

    ```
    docker run --rm dp.apps.rancher.io/containers/cosign:2 \
        tree dp.apps.rancher.io/containers/IMAGE_NAME@DIGEST \
        --registry-username USERNAME --registry-password PASSWORD
    ```

    

    For example, to obtain the list of available OCI attestations for `etcd 3.5.12` on the `amd64` architecture, using the previously obtained digest, execute the following command:

    

    ```
    $ docker run --rm dp.apps.rancher.io/containers/cosign:2 \
        tree dp.apps.rancher.io/containers/etcd@sha256:7e4ec052525fad97b54a66801e4c2a11887c0f42a1622148d7234e1164169753 \
        --registry-username USERNAME --registry-password PASSWORD

    📦 Supply Chain Security Related artifacts for an image: dp.apps.rancher.io/containers/etcd@sha256:7e4ec052525fad97b54a66801e4c2a11887c0f42a1622148d7234e1164169753
    └── 💾 Attestations for an image tag: dp.apps.rancher.io/containers/etcd:sha256-7e4ec052525fad97b54a66801e4c2a11887c0f42a1622148d7234e1164169753.att
       ├── 🍒 sha256:9eafd00bc9ca32550ca4c178631c213165a786abb27197dc5d9d067e48977866
       ├── 🍒 sha256:6a7d0ec2caaaa15a88e1d62cdbe3e7190c4b6601e5dea0256598cfe84a18cec5
       ├── 🍒 sha256:004d4bf7384636eeea9588ad597e1383b867a7823c7e1add5d381b1e8fa381cf
       ├── 🍒 sha256:8c76d06cd977b452a4a68759349b4ada96b8648a52738493e36d55f831cece3c
       ├── 🍒 sha256:906ebacb82b1db8751fd76a53b060907d11560d35a2a84282197d47738557df1
       └── 🍒 sha256:76d23404909e78c48a428705a2656c9f61c45cbed0919199bc5dd0a8f6d7c5d4
    └── 🔐 Signatures for an image tag: dp.apps.rancher.io/containers/etcd:sha256-7e4ec052525fad97b54a66801e4c2a11887c0f42a1622148d7234e1164169753.sig
       └── 🍒 sha256:5cba0994d00b2ad7e8273371ad64483eb15613d971a720e987e1b81831615838
    ```

    

3.  Optionally, download all attestations:

    Using *crane*, you can download all attestations into a `.tar` archive using the following command:

    

    ```
    crane pull dp.apps.rancher.io/containers/IMAGE_NAME:sha256-DIGEST attestations.tar
    ```

    

    For example, to pull all OCI attestations for `etcd 3.5.12` on the `amd64*` architecture, into the `attestations.tar` archive, execute the following command:

    

    ```
    crane pull dp.apps.rancher.io/containers/etcd:sha256-7e4ec052525fad97b54a66801e4c2a11887c0f42a1622148d7234e1164169753.att attestations.tar
    ```

    

    Using *cosign*, you can download specific attestations, for example:

    - SLSA provenance:

      

      ```
      docker run --rm dp.apps.rancher.io/containers/cosign:2 \
          download attestation dp.apps.rancher.io/containers/IMAGE_NAME@DIGEST \
          --predicate-type slsaprovenance \
          --registry-username USERNAME --registry-password PASSWORD \
          | jq -r .payload | base64 -d | jq .
      ```

      

    - SPDX SBOM:

      

      ```
      docker run --rm dp.apps.rancher.io/containers/cosign:2 \
          download attestation dp.apps.rancher.io/containers/IMAGE_NAME@DIGEST \
          --predicate-type spdx \
          --registry-username USERNAME --registry-password PASSWORD \
          | jq -r .payload | base64 -d | jq .
      ```

      

4.  Verify the signature for all attestations using *cosign*:

    

    ```
    docker run --rm dp.apps.rancher.io/containers/cosign:2 \
        verify-attestation dp.apps.rancher.io/containers/IMAGE_NAME@DIGEST \
        --registry-username USERNAME --registry-password PASSWORD \
        --key https://apps.rancher.io/ap-pubkey.pem
    ```

    

    For example, to verify all OCI attestations for `etcd 3.5.12` on the `amd64` architecture, into the `attestations.tar` archive, execute the following command:

    

    ```
    $ docker run --rm dp.apps.rancher.io/containers/cosign:2 \
        verify-attestation dp.apps.rancher.io/containers/etcd@sha256:7e4ec052525fad97b54a66801e4c2a11887c0f42a1622148d7234e1164169753 \
        --registry-username USERNAME --registry-password PASSWORD \
        --key https://apps.rancher.io/ap-pubkey.pem

    Verification for dp.apps.rancher.io/containers/etcd@sha256:7e4ec052525fad97b54a66801e4c2a11887c0f42a1622148d7234e1164169753 --
    The following checks were performed on each of these signatures:
      - The cosign claims were validated
      - Existence of the claims in the transparency log was verified offline
      - The signatures were verified against the specified public key
    {"payloadType":"application/vnd.in-toto+json","payload":"eyJfdHlwZSI6Imh0dHBzOi8vaW4tdG90by5pby9TdGF0ZW1lbnQvdjAuMSIsInByZWRpY2F0ZSI6eyJkYXRhIjoiXG4tLS0tLS0tLS0tLSBTQ0FOIFNVTU1BUlkgLS0tLS0tLS0tLS1cbktub3duIHZpcnVzZXM6IDg2ODcyMjRcbkVuZ2luZSB2ZXJzaW9uOiAwLjEwMy4xMVxuU2Nhbm5lZCBkaXJlY3RvcmllczogODcwXG5TY2FubmVkIGZpbGVzOiA2NjlcbkluZmVjdGVkIGZpbGVzOiAwXG5EYXRhIHNjYW5uZWQ6IDkwLjU5IE1CXG5EYXRhIHJlYWQ6IDgxLjcyIE1CIChyYXRpbyAxLjExOjEpXG5UaW1lOiAxNi4zMjkgc2VjICgwIG0gMTYgcylcblN0YXJ0IERhdGU6IDIwMjQ6MDM6MjggMTY6MDk6MzNcbkVuZCBEYXRlOiAgIDIwMjQ6MDM6MjggMTY6MDk6NDlcbiIsInRpbWVzdGFtcCI6IjIwMjQtMDMtMjhUMTY6MDk6NDkuNzM3MTEzOTkwKzAwOjAwIn0sInByZWRpY2F0ZVR5cGUiOiJodHRwczovL2Nvc2lnbi5zaWdzdG9yZS5kZXYvYXR0ZXN0YXRpb24vdjEiLCJzdWJqZWN0IjpbeyJkaWdlc3QiOnsic2hhMjU2IjoiN2U0ZWMwNTI1MjVmYWQ5N2I1NGE2NjgwMWU0YzJhMTE4ODdjMGY0MmExNjIyMTQ4ZDcyMzRlMTE2NDE2OTc1MyJ9LCJuYW1lIjoiZHAuYXBwcy5yYW5jaGVyLmlvL2NvbnRhaW5lcnMvZXRjZCJ9XX0=","signatures":[{"sig":"s7ZMMoF1ST0iOBQ9Fw7fd8nviPS/OCmbCFzzCnDVFqih/NjtDNAiACDokrEWvSfMOX/l6QengDQ4KiittrqO/hsxUp00DTidG3JXZqoHWbrukpzemXKJZRegr2hZNJMoitIaJE9q+f0zmgjMczY2RNw/RN/AzZ8MMnRThjRsfIqR4rc6z1iNO7HHmAHfr+egUaH+FPtOt4pkKwOGZxfmZ3uRSGTWfqe0hODOt9OefEwaJA8TMv9Fd40YO9/ownrgDjySnF4paittPZAS5KqTNXZKsMO4nusRKO8ChRUEyr0waN20WUZlqRApXTTqpgt3FJdJYNDn3b7uMZUwcPUKog=="}]}
    ```

    

    If you have downloaded [ap-pubkey.pem](https://apps.rancher.io/ap-pubkey.pem) locally, you can use it to verify the signature for the OCI attestations:

    

    ```
    docker run --rm -v ./ap-pubkey.pem:/ap-pubkey.pem:ro \
        dp.apps.rancher.io/containers/cosign:2 \
        verify-attestation dp.apps.rancher.io/containers/IMAGE_NAME@DIGEST \
        --registry-username USERNAME --registry-password PASSWORD \
        --key /ap-pubkey.pem
    ```

    

## Helm charts

To verify the signature of an Application Collection Helm chart, execute the following command:


```
docker run --rm dp.apps.rancher.io/containers/cosign:2 \
    verify dp.apps.rancher.io/charts/CHART_NAME:VERSION \
    --registry-username USERNAME --registry-password PASSWORD \
    --key https://apps.rancher.io/ap-pubkey.pem
```


For example, the following command will verify the signature of the Application Collection Helm chart for `etcd 0.1.0` (which will deploy `etcd 3.5.11`):


```
$ docker run --rm dp.apps.rancher.io/containers/cosign:2 \
    verify dp.apps.rancher.io/charts/etcd:0.1.0 \
    --registry-username USERNAME --registry-password PASSWORD \
    --key https://apps.rancher.io/ap-pubkey.pem

Verification for dp.apps.rancher.io/charts/etcd:0.1.0 --
The following checks were performed on each of these signatures:
  - The cosign claims were validated
  - The claims were present in the transparency log
  - The signatures were integrated into the transparency log when the certificate was valid
  - The signatures were verified against the specified public key

[{"critical":{"identity":{"docker-reference":"registry.suse.de/devel/orchid/charts/charts/etcd"},"image":{"docker-manifest-digest":"sha256:be3d7b10332fb25ed0e73e611a0e302827137cb3c6d5e82ac847290b2a051625"},"type":"cosign container image signature"},"optional":{"creator":"OBS"}}]
```


If you have downloaded [ap-pubkey.pem](https://apps.rancher.io/ap-pubkey.pem) locally, you can use it to verify the signature for Helm chart artifacts:


```
docker run --rm -v ./ap-pubkey.pem:/ap-pubkey.pem:ro \
    dp.apps.rancher.io/containers/cosign:2 \
    verify dp.apps.rancher.io/charts/etcd:0.1.0 \
    --registry-username USERNAME --registry-password PASSWORD \
    --key /ap-pubkey.pem
```


Last modified July 10, 2025


