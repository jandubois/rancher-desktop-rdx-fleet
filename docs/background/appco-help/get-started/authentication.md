---
description: Learn how to authenticate to the different services and start using Application Collection
lang: en
robots: index, follow
title: Authentication \| SUSE Application Collection
twitter:card: summary
twitter:description: Learn how to authenticate to the different services and start using Application Collection
twitter:title: Authentication
viewport: width=device-width,initial-scale=1,shrink-to-fit=no
---


1.  [Get started](...md)
2.  Authentication


# Authentication


Learn how to authenticate to the different services and start using Application Collection


Most operations in Application Collection (such as installing a Helm chart, running a container image or consuming the REST API) require authentication. In this page, you will learn about the different authentication mechanisms that Application Collection offers and how to configure them in the most common tools.

## Web application

Most parts of the [web application](https://apps.rancher.io/) are publicly available and do not require users to log in. However, there are other parts (mostly related to the management of user and service accounts) that need for authentication.

The only way to authenticate in the web application is with a [user account](../glossary/index.html#user-account). [Here](../first-steps/index.html#how-can-i-get-a-user-account) we explain how to get one.

## Distribution Platform or REST API

In order to authenticate to the Distribution Platform or the REST API, you can use either your user account or a [service account](../glossary/index.html#service-account). Although both types of accounts are configured in a pretty similar way, they offer different capabilities. Hence, it is very important to understand their nuances before making a choice of which one to use.

User accounts and service accounts both allow you to authenticate to Application Collection through different non-graphical clients.

- With a **user** account, you need to provide your **username and an [access token](../glossary/index.html#access-token)**.
- With a **service** account, you must provide its **username and secret**.

From a conceptual point of view, when you use a user account you’re authenticating on behalf of yourself. However, when using a service account you’re authenticating in behalf of an organization. This leads to the first important difference between them: **subscriptions**. As a service account is linked to one single organization, it only has the subscriptions of the organization that it belongs to. However, a user account will inherit all the subscriptions of all the organizations that the user belongs to.

Let’s see that with a practical example. Imagine that we have a user `john.doe@my-org.com` that is member of two organizations:

- *Organization A* has two subscriptions: `Prime` and `SUSE AI`.
- *Organization B* has one subscription: `Prime`.

When the user authenticates with his user account (username + access token), he will inherit the subscriptions of all the organizations of the user. Hence, with his user account the user will be able to pull content that requires either a `Prime` or a `SUSE AI` subscription.

However, if the user authenticates with a service account that belongs to *Organization B* he will only be able to pull content that requires `Prime` subscription. With this service account the user will not be able to pull content that requires `SUSE AI` subscription, as he is authenticating in behalf of *Organization B* and *Organization B* does not have the `SUSE AI` subscription.

Another important difference between user accounts and service accounts is related to their configured **rate limits**. As a general rule, service accounts have less restrictive rate limits than user accounts, allowing them to pull more images in a given time frame. Further information about the default rate limits and how they are applied can be found [here](get-started/rate-limits). Please, make sure you have read and understood this documentation before choosing your desired authentication method.

Finally, there are some differences regarding how access tokens and service accounts are created. The process for each of them is detailed in the following sections.

### Create an access token

As mentioned before, in order to authenticate using your user account you need an access token. You can create as many access tokens as you want. The only requirement for creating an access token is that you **have a user account with access to Application Collection**. If you don’t have one yet, you can check [here](../first-steps/index.html#how-can-i-get-a-user-account) how to get one.

Once you have access to Application Collection, you can create a access token following these steps.

1.  Open the [web application](https://apps.rancher.io) in your browser of choice and sign in (if you don’t know how to authenticate in the web application, check [this section](index.html#in-the-web-application)).
2.  In the upper-right corner you will see your profile picture. Click on it.
3.  In the pop-up, click `Settings` → `Access tokens`.
4.  Insert a meaningful description for the new token in the input below *Create access token*.
5.  Click `Create`. This will show a green box, with the token contents on it.

![Token example](images/get-started/access-token.png "Token example")

### Create a service account

Service accounts are always linked to an organization. It is important to notice that only the admins of an organization are entitled to create service accounts for it.

If you **have a user account with access to Application Collection**, you will be able to create service accounts for the organizations where you are an admin by following these steps:

1.  Open the [web application](https://apps.rancher.io) in your browser of choice and sign in (if you don’t know how to authenticate in the web application, check [this section](index.html#in-the-web-application)).
2.  In the upper-right corner you will see your profile picture. Click on it.
3.  In the pop-up, click `Settings` → `Service accounts`.
4.  Insert a meaningful description for the service account in the input below *Create service account*, and select the target organization.
5.  Click \`Create. This will show a green box, with the service account secret on it.

![Service account example](images/get-started/service-account.png "Service account example")

## Use CLI tools

At this point, you already created either an access token or a service account, but you are not sure about how to use it. Below we will show you how to quickly use it with `docker`, `podman`, `helm`, `kubectl` and `curl`.

> Every time an access token or service account is created, copy-pastable helper commands are shown for configuring the token immediately.

### Docker

To set up [Docker](https://www.docker.com/), you will need to open a terminal and run:


```
docker login dp.apps.rancher.io -u <your-username-or-sa-username> -p <access-token-or-sa-secret>
```


After that, you can check the configuration by pulling an image. This is an example of the output you should get upon a successful pull:


```
$ docker pull dp.apps.rancher.io/containers/openjdk:17.0.10
17.0.10: Pulling from containers/openjdk
26cbacfd9b54: Pull complete 
d3e7d6906a04: Pull complete 
Digest: sha256:0f14a2a18e441da428b63e3854fe29fa6f9f20af5b99ba9780adb36bee65f5e4
Status: Downloaded newer image for dp.apps.rancher.io/containers/openjdk:17.0.10
dp.apps.rancher.io/containers/openjdk:17.0.10
```


### Podman

You can also configure [Podman](https://podman.io/) to pull images from Application Collection. Execute the following command:


```
podman login dp.apps.rancher.io -u <your-username-or-sa-username> -p <access-token-or-sa-secret>
```


You can verify that the configuration is correct by pulling an image, for example:


```
$ podman pull dp.apps.rancher.io/containers/ruby:3.3.0
Trying to pull dp.apps.rancher.io/containers/ruby:3.3.0...
Getting image source signatures
Copying blob sha256:6911d8a6e0d680cdfa227956a00667fe6cd1e2c111fa3c588d1cccc0b621bfe2
Copying blob sha256:4191f2fe96e960b152f79a6b0dcb40ad599b834e72b79edc61e6a627fec776c7
Copying config sha256:c7b272c4b0b6d09b43a32cf3215d0c86c5f148c00d6d049755f292e1c018cfa6
Writing manifest to image destination
c7b272c4b0b6d09b43a32cf3215d0c86c5f148c00d6d049755f292e1c018cfa6
```


### Helm

Configuring [Helm](https://helm.sh/) to use Application Collection is a matter of running a single command:


```
helm registry login dp.apps.rancher.io -u <your-username-or-sa-username> -p <access-token-or-sa-secret>
```


You can check that it worked by pulling one of the Collection’s charts:


```
$ helm pull oci://dp.apps.rancher.io/charts/apache-apisix --version 2.4.0    
Pulled: dp.apps.rancher.io/charts/apache-apisix:2.4.0
Digest: sha256:533b7684559691782b42ee81bfde1a19ddfe81eb7cce108b01435ce7d25a7027
```


> If you want to install charts on a Kubernetes cluster, continue to the next section.

### Kubernetes

To deploy images from Application Collection to k8s workloads, you will need to configure a Kubernetes [pull secret](https://kubernetes.io/docs/tasks/configure-pod-container/pull-image-private-registry/):


```
kubectl create secret docker-registry application-collection --docker-server=dp.apps.rancher.io \
    --docker-username=<your-username-or-sa-username> \
    --docker-password=<access-token-or-sa-secret>
```


After that, you should be able to run any workload using our images:


```
$ kubectl run nginx --image dp.apps.rancher.io/containers/nginx:1.24.0 --overrides='{"spec": {"imagePullSecrets":[{"name": "application-collection"}]}}'
$ kubectl get pod nginx
NAME    READY   STATUS    RESTARTS   AGE
nginx   1/1     Running   0          10s
```


There are other ways of passing the `imagePullSecret` that may fit your needs better. For that, you can check [this article](https://www.baeldung.com/ops/kubectl-run-image-pull-secret#introduction).

### cURL

If you get to this point, you may want to start using [the REST API](https://api.apps.rancher.io/swagger-ui/index.html?urls.primaryName=metadata).

This is an example of making a request with [cURL](https://curl.se/), that uses basic authentication with the newly created token:


```
curl -u <your-username-or-sa-username>:<access-token-or-sa-secret> https://api.apps.rancher.io/v1/applications
```


If you’re going to use the API intensively, we suggest using other tools such as [Postman](https://www.postman.com/) or the embedded [Swagger UI](https://swagger.io/tools/swagger-ui/). In any case, you will need to pick basic authentication, using your username or the service account as `username` and an access token or the service account secret as `password`.


Last modified September 9, 2025


