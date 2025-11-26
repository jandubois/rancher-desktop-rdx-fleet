---
description: Learn how to install and use Local Path Provisioner
lang: en
robots: index, follow
title: Local Path Provisioner \| SUSE Application Collection
twitter:card: summary
twitter:description: Learn how to install and use Local Path Provisioner
twitter:title: Local Path Provisioner
viewport: width=device-width,initial-scale=1,shrink-to-fit=no
---


1.  [Reference guides](...md)
2.  Local Path Provisioner


# Local Path Provisioner


Learn how to install and use Local Path Provisioner


![Local Path Provisioner Logo](images/reference-guides/logo-local-path-provisioner.png "Local Path Provisioner Logo")

## Get started

[Local Path Provisioner](https://apps.rancher.io/applications/local-path-provisioner) provides a way for the Kubernetes users to utilize the local storage in each node. Based on the user configuration, the Local Path Provisioner will create either hostPath or local based persistent volume on the node automatically.

Before exploring the chart characteristics, let’s start by deploying the default configuration:


```
helm install <release-name> oci://dp.apps.rancher.io/charts/local-path-provisioner \
    --set global.imagePullSecrets={application-collection}
```


> Please check our [authentication guide](../../get-started/authentication/index.html#kubernetes) if you need to configure Application Collection OCI credentials in your Kubernetes cluster.

## Chart overview

The Local Path Provisioner Helm chart distributed in Application Collection is based on the [Local Path Provisioner Helm chart](https://github.com/rancher/local-path-provisioner/tree/master/deploy/chart/local-path-provisioner) and adapted to include our best practices. As such, any chart-related documentation provided by upstream will work out of the box with our chart. Additionally to the upstream chart documentation, you can check the upstream base [README.md](https://github.com/rancher/local-path-provisioner) for more in-depth details about the configuration of the provisioner.

By default, the chart will define a new storage class for dynamic provisioning of type [`hostPath`](https://kubernetes.io/docs/concepts/storage/volumes/#hostpath) and the pertaining controller as a single-pod deployment.

## Chart configuration

To view the supported configuration options and documentation, run:


```
helm show values oci://dp.apps.rancher.io/charts/local-path-provisioner
```


### Define a storage class

The storage class that is created by default is highly customizable via Helm chart parameters. It defaults to:


```
storageClass:
  create: true
  ## Set a provisioner name. If unset, a name will be generated.
  # provisionerName: rancher.io/local-path

  ## Set StorageClass as the default StorageClass
  defaultClass: false
  ## The default volume type this storage class creates, can be "local" or "hostPath"
  defaultVolumeType: hostPath
  ## Set a StorageClass name
  name: local-path
  ## ReclaimPolicy field of the class, which can be either Delete or Retain
  reclaimPolicy: Delete
  ## volumeBindingMode field controls when volume binding and dynamic provisioning should occur, can be "Immediate" or "WaitForFirstConsumer"
  volumeBindingMode: WaitForFirstConsumer
  ## Set a path pattern, if unset the default will be used
  # pathPattern: "{{ .PVC.Namespace }}-{{ .PVC.Name }}"
```


As an example, to configure the new storage class named as `my-storage-class`, you would install the Helm chart providing the following command line flags:


```
helm install <release-name> oci://dp.apps.rancher.io/charts/local-path-provisioner \
    --set global.imagePullSecrets={application-collection} \
    --set storageClass.name=my-storage-class
```


You can confirm that the storage class is created:


```
$ kubectl get storageclass my-storage-class
NAME               PROVISIONER                                           RECLAIMPOLICY   VOLUMEBINDINGMODE      ALLOWVOLUMEEXPANSION   AGE
my-storage-class   cluster.local/<release-name>-local-path-provisioner   Delete          WaitForFirstConsumer   true                   2m26s
```


Then, when you create a persistent volume claim specifying the new storage class and attach the volume claim to a pod, a persistent volume is dynamically provisioned and bound to the pod. See the described example below with the corresponding Kubernetes resources(`pod-with-pvc.yaml`).


```
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: my-pvc
spec:
  accessModes:
    - ReadWriteOnce
  storageClassName: my-storage-class
  resources:
    requests:
      storage: 32Mi
---
apiVersion: v1
kind: Pod
metadata:
  name: my-pod
spec:
  imagePullSecrets:
    - name: application-collection
  restartPolicy: Never
  containers:
    - name: container
      image: dp.apps.rancher.io/containers/bci-busybox:15.6
      volumeMounts:
        - mountPath: /vol
          name: vol
      command: ["/bin/sh", "-c", "echo 'hello world' >/vol/file"]
  volumes:
    - name: vol
      persistentVolumeClaim:
        claimName: my-pvc
```


```
$ kubectl create -f pod-with-pvc.yaml
persistentvolumeclaim/my-pvc created
pod/my-pod created
```


```
$ kubectl get persistentvolumeclaim,persistentvolume
NAME                           STATUS   VOLUME                                     CAPACITY   ACCESS MODES   STORAGECLASS       VOLUMEATTRIBUTESCLASS   AGE
persistentvolumeclaim/my-pvc   Bound    pvc-85ea7e57-d99d-4ae0-bc38-af439bc1e9ca   32Mi       RWO            my-storage-class   <unset>                 3m40s

NAME                                                        CAPACITY   ACCESS MODES   RECLAIM POLICY   STATUS   CLAIM            STORAGECLASS       VOLUMEATTRIBUTESCLASS   REASON   AGE
persistentvolume/pvc-85ea7e57-d99d-4ae0-bc38-af439bc1e9ca   32Mi       RWO            Delete           Bound    default/my-pvc   my-storage-class   <unset>                          3m37s
```


### Where to store data

The specific path where the data is stored on each node is configured by the `nodePathMap` Helm chart parameter. Multiple paths can be configured per node. It defaults to:


```
nodePathMap:
  - node: DEFAULT_PATH_FOR_NON_LISTED_NODES
    paths:
      - /opt/local-path-provisioner
```


In the example from the [section above](index.html#define-a-storage-class), the pod writes *“hello world”* to a file backed by `hostPath` persistent storage. The default value for `nodePathMap` was not modified. If you have access to the Kubernetes node where the pod was scheduled, you can confirm how the file is hosted in the configured path `/opt/local-path-provisioner`. For example, in a Kubernetes cluster provided by [Rancher Desktop](https://rancherdesktop.io):


```
$ rdctl shell bash -c 'cat /opt/local-path-provisioner/pvc*my-pvc/file'
hello world
```


### Scripts setup and teardown

The creation and deletion of data in the filesystem node is controlled by two shell scripts. These shell scripts as well as the helper pod running them can be configured via the `configmap` Helm chart parameter:


```
configmap:
  # specify the config map name
  name: local-path-config
  # specify the custom script for setup and teardown
  setup: |-
    #!/bin/sh
    set -eu
    mkdir -m 0777 -p "$VOL_DIR"
  teardown: |-
    #!/bin/sh
    set -eu
    rm -rf "$VOL_DIR"
  helperPod:
    # Allows to run the helper pod in another namespace. Uses release namespace by default.
    namespaceOverride: ""
    name: "helper-pod"
    annotations: {}
```


Find more information about the `setup` and `teardown` scripts in the [upstream documentation](https://github.com/rancher/local-path-provisioner#scripts-setup-and-teardown-and-the-helperpodyaml-template).

## Operations

### Upgrade the chart

In general, an in-place upgrade of your Local Path Provisioner installation can be performed using the built-in Helm upgrade workflow:


```
helm upgrade <release-name> oci://dp.apps.rancher.io/charts/local-path-provisioner
```


> Be aware that changes from version to version may include breaking changes in Local Path Provisioner itself or in the Helm chart templates. In other cases, the upgrade process may require additional steps to be performed. Always check the [release notes](https://github.com/rancher/local-path-provisioner/releases) before proceeding with an upgrade.

### Uninstall the chart

Removing an installed Local Path Provisioner Helm chart release is simple:


```
helm uninstall <release-name>
```


Persistent volume claims and the associated persistent volumes managed by the provisioner are left installed when uninstalling the Helm chart. If you don’t need those volumes anymore, it is recommended to remove them **before** uninstalling the Helm chart and the deletion will be gracefully handled by the provisioner.

> Remember to remove any other resources you deployed during this guide.


```
kubectl delete pod/my-pod
kubectl delete pvc/my-pvc

helm uninstall <release-name>
```


Last modified September 9, 2025


