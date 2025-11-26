---
description: Learn how to run and use kubectl
lang: en
robots: index, follow
title: kubectl \| SUSE Application Collection
twitter:card: summary
twitter:description: Learn how to run and use kubectl
twitter:title: kubectl
viewport: width=device-width,initial-scale=1,shrink-to-fit=no
---


1.  [Reference guides](...md)
2.  kubectl


# kubectl


Learn how to run and use kubectl


![kubectl Logo](images/reference-guides/logo-kubectl.png "kubectl Logo")

## Get started

[kubectl](https://apps.rancher.io/applications/kubectl) is a command line tool for communicating with a Kubernetes cluster’s control plane, using the Kubernetes API.

Before exploring the container’s possibilities, let’s start by deploying the default configuration:


```
docker run \
    --interactive \
    --tty \
    --rm \
    --name <container-name> \
    dp.apps.rancher.io/containers/kubectl:1.34.1
```


> Check our [authentication guide](../../get-started/authentication/index.html#kubernetes) if you need to configure Application Collection OCI credentials in your Docker client.

## Container overview

Since there is no official upstream container for kubectl, our container is built from scratch using a SUSE Linux BCI Micro base image and includes our best practices.

## Apply a template from a file

To run the kubectl container, execute the following command:


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
    dp.apps.rancher.io/containers/kubectl:1.34.1
```


> We shared the host’s kubeconfig file and set the `KUBECONFIG` environment variable as required by the Helm CLI to authenticate and reach your Kubernetes clusters. We also shared the host’s network to ensure the Helm container can communicate with the cluster’s API server.

Then, we’ll create an [NGINX](https://apps.rancher.io/applications/nginx) deployment template file to test the container’s ability to create resources in the Kubernetes cluster.


```
# nginx-deployment.yaml
apiVersion: v1
kind: Deployment
metadata:
  name: nginx
  labels:
    app: nginx
spec:
  replicas: 1
  selector:
    matchLabels:
      app: nginx
  template:
    metadata:
      labels:
        app: nginx
    spec:
      imagePullSecrets:
      - name: application-collection
      containers:
      - name: nginx
        image: dp.apps.rancher.io/containers/nginx:1.29.3
        ports:
        - containerPort: 80
```


Use the following commands to copy the template inside the kubectl container and apply it from there.


```
docker cp nginx-deployment.yaml kubectl-pod:/tmp/nginx-deployment.yaml
```


```
kubectl apply -f /tmp/nginx-deployment.yaml
```


Run the command below to check that the Deployment was created and its Pod is running with:


```
$ kubectl get deployments
NAME    READY   UP-TO-DATE   AVAILABLE   AGE
nginx   1/1     1            1           5s

$ kubectl get pods
NAME                     READY   STATUS    RESTARTS   AGE
nginx-69b67d89cc-279c7   1/1     Running   0          5s
```


## Scale up the deployment

We deployed [NGINX](https://apps.rancher.io/applications/nginx) with one Pod. Now, we will scale up the deployment to three Pods with:


```
kubectl scale deployments/nginx --replicas 3
```


Then, we can check the `diff` of the modified Deployment against its original template by executing:


```
kubectl diff -f /tmp/nginx-deployment.yaml
```


## Delete the deployment

Once we are done testing the NGINX Deployment, it can be removed with the following command:


```
kubectl delete -f /tmp/nginx-deployment.yaml
```


Last modified November 17, 2025


