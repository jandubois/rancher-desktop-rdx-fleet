---
description: Mirror Application Collection container images and Helm charts with JFrog Artifactory
lang: en
robots: index, follow
title: Mirror with JFrog Artifactory \| SUSE Application Collection
twitter:card: summary
twitter:description: Mirror Application Collection container images and Helm charts with JFrog Artifactory
twitter:title: Mirror with JFrog Artifactory
viewport: width=device-width,initial-scale=1,shrink-to-fit=no
---


1.  [How-to guides](...md)
2.  Mirror with JFrog Artifactory


# Mirror with JFrog Artifactory


Mirror Application Collection container images and Helm charts with JFrog Artifactory


![JFrog Artifactory Logo](images/howto-guides/logo-horizontal-artifactory.png "JFrog Artifactory Logo")

Application Collection provides all container images and Helm charts in an OCI-compliant registry that is available through the Internet. In certain cases, such as air-gapped environments, it might be desirable to access those images through a proxy registry to have better control over all the network requests involved in the deployment of container images and Helm charts within an organization.

In this guide, we will describe how this problem can be solved using [JFrog Artifactory](https://jfrog.com/artifactory/).

## Proxy registries with Artifactory

Using Artifactory as a proxy registry allows you to restrict all required network requests to Application Collection, except those made by the Artifactory instance to proxy the container images and Helm charts. This way, only the Artifactory instance would require network access to Application Collection in an organization’s network. In Artifactory, these proxy registries are called *Remote Repositories* and function as a proxy for external OCI repositories and as a cache for downloaded artifacts like container images and Helm charts.

Artifactory offers different repository types to provide container images and Helm charts, depending on the packaging type. Although configurable as a Helm or Docker repository, the OCI one will be relevant repository type for this documentation given Application Collection’s OCI support.

### Configure Artifactory as a Proxy Cache

First, go to the `Administration` module and click the `Repositories` tab that appears on the sidebar. Then, open the `Create a Repository` drop-down list and select `Remote`\*. On the new view, search for *OCI*, where the following data needs to be inputted:

- **Repository Key**: *application-collection*
- **URL**: `https://dp.apps.rancher.io`
- **User Name**: A [service account](../../get-started/authentication/index.html#create-a-service-account) username
- **Password / Access Token**: The service account secret
- Optionally, click `Test` to verify the credentials

![Create Artifactory remote repository](images/howto-guides/mirror-artifactory-remote-repo.png "Create Artifactory remote repository")

Artifactory will now be configured to act as a proxy cache for Application Collection.

> Artifactory’s repositories support replication, though only from other Artifactory instances. Given this limitation, replication can’t be setup for Application Collection.

#### Configure OCI client authentication

Artifactory provides an easy set-up guide for different OCI clients; the `docker` CLI being one of them. To do so, access the `Set Me Up` action from the repositories’ list and select the `BuildKit/Buildctl` client in the upper right corner. After that, click `Generate Token & Create Instructions` to obtain the Artifactory access token.

![Set up an OCI client](images/howto-guides/mirror-artifactory-client-setup.png "Set up an OCI client")

Once generated, the following command will set up `docker` credentials locally:


```
docker login applicationcollection.jfrog.io -u <artifactory_username> -p <generated_token>
```


Please refer to Artifactory’s [authentication documentation](https://jfrog.com/help/r/jfrog-artifactory-documentation/set-up-oci-clients-to-work-with-artifactory) to configure other OCI clients, such as Helm or Kubernetes, using the generated credentials.

#### Pull a container image

To test the remote OCI repository, you can pull a container image from Application Collection to verify that it works as expected.

For example, if your Artifactory instance is living under the *applicationcollection.jfrog.io* domain and the Artifactory repository’s name is *application-collection*, the following command would allow you to pull the container image `dp.apps.rancher.io/containers/postgresql:16.3-9.8`:


```
docker pull applicationcollection.jfrog.io/application-collection/containers/postgresql:16.3-9.8
```


#### Deploy a Helm chart

You can also test the remote OCI repository by deploying a Helm chart from Application Collection to verify that it works as expected.

For example, if your Artifactory instance is living under the *applicationcollection.jfrog.io* domain and the Artifactory repository’s name is *application-collection*, the following command would allow us to deploy the Application Collection PostgreSQL Helm chart from `oci://applicationcollection.jfrog.io/application-collection/charts/postgresql`:


```
helm install RELEASE-NAME oci://applicationcollection.jfrog.io/application-collection/charts/postgresql \
    --set global.imageRegistry=applicationcollection.jfrog.io/application-collection \
    --set global.imagePullSecrets={application-collection}
```


Last modified September 9, 2025


