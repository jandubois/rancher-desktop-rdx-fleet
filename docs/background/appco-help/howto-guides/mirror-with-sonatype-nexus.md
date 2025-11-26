---
description: Mirror Application Collection container images and Helm charts with Sontaype Nexus Repository
lang: en
robots: index, follow
title: Mirror with Sonatype Nexus Repository \| SUSE Application Collection
twitter:card: summary
twitter:description: Mirror Application Collection container images and Helm charts with Sontaype Nexus Repository
twitter:title: Mirror with Sonatype Nexus Repository
viewport: width=device-width,initial-scale=1,shrink-to-fit=no
---


1.  [How-to guides](...md)
2.  Mirror with Sonatype Nexus Repository


# Mirror with Sonatype Nexus Repository


Mirror Application Collection container images and Helm charts with Sontaype Nexus Repository


![Sonatype Logo](images/howto-guides/logo-horizontal-sonatype-nexus-repository.png "Sonatype Nexus Repository Logo")

Application Collection provides all container images and Helm charts in an OCI-compliant registry that is available through the Internet. In certain cases, such as air-gapped environments, it might be desirable to access those images through a proxy registry. This enables control of all the network requests involved in the deployment of container images and Helm charts within an organization.

In this guide, we will describe how this problem can be solved using [Sonatype Nexus Repository](https://www.sonatype.com/products/sonatype-nexus-repository).

## Proxy registries with Nexus

Using Sonatype Nexus as a proxy registry allows you to restrict all required network requests to Application Collection, except those made by the Nexus instance to proxy the container images and Helm charts. This way, only the Nexus instance would require network access to Application Collection in an organization’s network.

To set up the proxy, first create a repository for Application Collection. In your Nexus instance log in as administrator, select the management view on the top bar and then navigate to `Repository` → `Repositories` on the sidebar. Click `Create repository`, select *docker (proxy)* on the new view and fill in the following values in the creation form:

- **Name**: *application-collection*
- **Repository Connectors**
  - **HTTP**: check the box and select port *5000*
- **Remote storage**: `https://dp.apps.rancher.io`
- **HTTP**:
  - **Authentication**: check the box and select *Username*
  - **Username**: A [user account](../../get-started/glossary/index.html#user-account) or [service account](../../get-started/authentication/index.html#create-a-service-account) username
  - **Password**: The user account access token or service account secret

![Create Nexus repository](images/howto-guides/mirror-nexus-repository.png "Create Nexus repository")

Click on `Create repository`, and you will see the *application-collection* repository listed on the repositories page.

> For a production-ready scenario use the HTTPS Repository Connector instead, and service account credentials to secure connections and avoid hitting rate limits.

## Pull a container image

To test the repository configuration, you can pull a container image from Application Collection to verify that it works as expected.

First, make sure you log in with `docker` to the Nexus repository (if you did not follow the previous step, replace `localhost:5000` by your Nexus host and application-collection repository connector port):


```
docker login localhost:5000 -u <nexus_username> -p <nexus_password>
```


Then, you can pull an image using the same path as if you were pulling it directly from Application Collection:


```
$ docker pull localhost:5000/containers/nodejs:20
20: Pulling from containers/nodejs
Digest: sha256:286d2d6d7dcc1f95b28aa6da09652f4b26a8e61131ff3f79eabdb4e7009833fc
Status: Image is up to date for localhost:5000/containers/nodejs:20
localhost:5000/containers/nodejs:20
```


## Deploy a Helm chart

Similarly to the previous section, the first step is logging in to the repository:


```
helm registry login localhost:5000 -u <nexus_username> -p <nexus_password>
```


Then, make sure you have set up[kubernetes authentication for Application Collection](http://localhost:1313/get-started/authentication/#kubernetes). Finally, install a Helm chart:


```
helm install grafana oci://localhost:5000/charts/grafana \
    --set global.imagePullSecrets={application-collection}
```


> The container images shipped within the Helm charts will still point to Application Collection (non-mirrored content).

## Validate the mirroring in Nexus

To double check that the mirroring is working as expected, log in to the Nexus web server and open the browsing view. Click `Search` on the sidebar, this will open up the search page. Here, click on `More criteria` → `Repository Name` and write *application-collection*. This will show you the list of images that have been mirrored to and served by Nexus.

![Mirrored images list](images/howto-guides/mirror-nexus-check.png "Mirrored images listy")

From this point on, you have the repository fully functional. You can now configure *Content Selectors* and *Privileges* to fine-grain the access management, *Cleanup Policies* to improve storage performance or *Routing Rules* for global routing restrictions.


Last modified September 9, 2025


