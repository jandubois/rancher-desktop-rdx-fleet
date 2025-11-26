---
description: Learn how to install and use Apache Kafka
lang: en
robots: index, follow
title: Apache Kafka \| SUSE Application Collection
twitter:card: summary
twitter:description: Learn how to install and use Apache Kafka
twitter:title: Apache Kafka
viewport: width=device-width,initial-scale=1,shrink-to-fit=no
---


1.  [Reference guides](...md)
2.  Apache Kafka


# Apache Kafka


Learn how to install and use Apache Kafka


![Apache Kafka Logo](images/reference-guides/logo-apache-kafka.png "Apache Kafka Logo")

## Get started

[Apache Kafka](https://apps.rancher.io/applications/apache-kafka) is an open-source distributed event streaming platform for high-performance data pipelines, streaming analytics, data integration and mission-critical applications.

Before exploring the chart characteristics, let’s start by deploying the default configuration:


```
helm install <release-name> oci://dp.apps.rancher.io/charts/apache-kafka \
    --set global.imagePullSecrets={application-collection}
```


> Please check our [authentication guide](../../get-started/authentication/index.html#kubernetes) if you need to configure Application Collection OCI credentials in your Kubernetes cluster.

## Chart overview

The Apache Kafka Helm chart distributed in Application Collection is made from scratch, which allowed us to include every best practice and standardization we deemed necessary. When creating it, the objective was to keep the underlying Apache Kafka features intact while simplifying some of its mechanisms when deployed in a Kubernetes environment.

The chart is only configurable to work in [Kraft mode](https://kafka.apache.org/documentation/#kraft). While upstream deprecated Zookeeper support in Apache Kafka 3.5, it was entirely removed in version 4.0.

By default, the chart will deploy three nodes that serve as both controllers and brokers. These nodes will only have SASL authentication enabled, which will be explained in depth later in this guide. This is the minimum setup supported by the chart and is configured to work out of the box.

## Chart configuration

To view the supported configuration options and documentation, run:


```
helm show values oci://dp.apps.rancher.io/charts/apache-kafka
```


### Configure the cluster

As explained earlier, the chart’s standard configuration consists of a three-node deployment, each having the dual role of controller and broker. That said, there are a few variations to this setup that can be effortlessly configured.

#### Deploy broker-only nodes

A typical Kafka cluster will have three or five controller nodes, potentially having a larger number of broker nodes. As such, you may want to deploy broker-only nodes. As an example, the following command will deploy three broker-only nodes in addition to the controller/broker ones:


```
helm upgrade --install <release-name> oci://dp.apps.rancher.io/charts/apache-kafka \
    --set broker.enabled=true
```


#### Deploy controller-only nodes

Given the clear difference between controllers and brokers, it can be more manageable to have the controller nodes operating only as such and not as controller/broker nodes:


```
helm upgrade --install <release-name> oci://dp.apps.rancher.io/charts/apache-kafka \
    --set broker.enabled=true \
    --set cluster.controllerBrokerRole=false
```


> Enabling broker-only nodes is a must for this cluster setup to work properly.

#### Deploy a custom number of nodes

Following the above logic, a standard scenario involves adjusting the number of deployed nodes. The following design will result in a cluster of nine nodes, which includes five controllers-only nodes and four brokers:


```
helm upgrade --install <release-name> oci://dp.apps.rancher.io/charts/apache-kafka \
    --set broker.enabled=true \
    --set cluster.controllerBrokerRole=false \
    --set cluster.nodeCount.controller=5 \
    --set cluster.nodeCount.broker=4
```


The `helm upgrade` will perform a cascade upgrade, so the new cluster will take some time to be online as old pods will need to be redeployed with the new configuration.

#### Retrieve the cluster ID

Kafka clusters are identified by a unique ID called cluster ID. Unless explicitly defined with the `cluster.clusterID` parameter, this ID is randomly generated in each new chart installation.

When performing an upgrade, the chart will automatically look for its current cluster ID and configure it in the newly deployed pods. Even so, there may be instances where you will need this ID. The current Kafka cluster ID can be checked by executing:


```
kubectl get configmap <release-name>-cluster -o jsonpath="{.data.clusterID}"
```


#### Use a multidisk setup

The chart simplifies the configuration process for log data replication through the `cluster.disksPerBroker` parameter. This parameter deploys “N” volumes per broker and automatically configures `log.dirs` in Kafka:


```
$ helm install <release-name> oci://dp.apps.rancher.io/charts/apache-kafka \
    --set cluster.disksPerBroker=2
$ kubectl get pvc -l app.kubernetes.io/instance=<release-name> -o name
persistentvolumeclaim/logs-0-<release-name>-controller-0
persistentvolumeclaim/logs-0-<release-name>-controller-1
persistentvolumeclaim/logs-0-<release-name>-controller-2
persistentvolumeclaim/logs-1-<release-name>-controller-0
persistentvolumeclaim/logs-1-<release-name>-controller-1
persistentvolumeclaim/logs-1-<release-name>-controller-2
```


> When persistence is disabled, the chart will deploy the amount of volumes specified in `disksPerBroker` instead.

### Security

Apache Kafka supports the authentication of connections to nodes from clients, other nodes and tools using SSL, SASL or a combination of both.

#### SASL

Before delving into the different options, it is necessary to understand our Apache Kafka chart has SASL enabled and uses the SASL/PLAIN mechanism by default. Thus, an administrator and initial users are created using placeholder credentials. You should always modify the default users in the initial setup. Let’s check how to do this.

When deploying the Apache Kafka chart as it is, you will deploy a cluster using SASL authentication via the PLAIN mechanism. That said, the list of supported SASL mechanisms is more extensive:

- SASL/GSSAPI
- SASL/PLAIN
- SASL/OAUTHBEARER

Any of the above configurations can be modified via the `auth` parameter:


```
auth:
  # -- Enable Apache Kafka password authentication
  enabled: true
  sasl:
    # -- Comma-separated list of enabled SASL mechanisms. Valid values are `GSSAPI`, `OAUTHBEARER` and `PLAIN`
    enabledMechanisms: "PLAIN"
    gssapi:
      ...
    plain:
      interbrokerUsername: "admin"
      interbrokerPassword: "admin_password"
      users:
        user_test: password_test
    oauthbearer:
      ...
```


As seen above, you can easily disable SASL authentication, enable additional SASL mechanisms or modify the used credentials. Remember to configure the parameters of each enabled mechanism for the cluster to be properly configured.

> The `SASL/SCRAM` mechanism is not yet supported in Kraft mode and is thus skipped in our chart.

#### TLS

Apache Kafka allows clients to use SSL for traffic encryption and authentication. By default, SSL is disabled but can be turned on if needed. Similar to SASL, TLS configuration can be found under the `tls` parameter:


```
tls:
  enabled: true
  # -- Store format for file-based keys and trust stores. Valid values are `JKS` and `PEM`
  format: "JKS"
  # -- Configures kafka broker to request client authentication. Valid values are `none`, `required` and `requested`
  clientAuth: "none"
  # -- Whether to require Apache Kafka to perform host name verification
  hostnameVerification: true
  # -- Name of the secret containing the Apache Kafka certificates
  ## Note: The secret must contain a keystore file per node
  ## Each keystore must follow the "<release-name>-<nodeType>-<N>.keystore.jks" naming schema
  ## That is, for a cluster with 3 controller and 3 broker nodes using the "JKS" format we'll need:
  ## - <release-name>-controller-[1..3].keystore.jks
  ## - <release-name>-broker-[1..3].keystore.jks
  existingSecret: "apache-kafka-tls-secret"
  # -- Password to access the JKS keystore file in case it is encrypted
  keystorePassword: "test_pass"
  # -- Truststore filename in the secret
  truststoreFilename: "truststore.jks"
  # -- Password to access the JKS truststore file in case it is encrypted
  truststorePassword: "test_pass"
  # -- The password of the private key in the keystore file
  keystoreKeyPassword: "test_pass"
```


Besides enabling TLS, the listener’s protocols must be updated to use an SSL protocol, be it `SSL` or `SASL_SSL`:


```
cluster:
  listeners:
    client:
      protocol: SSL
    controller:
      protocol: SSL
    interbroker:
      protocol: SSL
```


The above configuration entails the most basic TLS setup needed. As it is, you need to provide a Kubernetes secret containing a keystore for each node and the truststore file. After that, you will have to define both the secret and passwords in our `values.yaml` and the chart will configure the provided `.jks` in every deployed node. For a cluster with three controllers and three brokers that would mean:


```
$ kubectl create secret generic apache-kafka-tls-secret \
    --from-file=keystore/apache-kafka-controller-0.keystore.jks \
    --from-file=keystore/apache-kafka-controller-1.keystore.jks \
    --from-file=keystore/apache-kafka-controller-2.keystore.jks \
    --from-file=keystore/apache-kafka-broker-0.keystore.jks \
    --from-file=keystore/apache-kafka-broker-1.keystore.jks \
    --from-file=keystore/apache-kafka-broker-2.keystore.jks \
    --from-file=truststore/truststore.jks
secret/apache-kafka-tls-secret created
```


Our Apache Kafka chart currently supports TLS using JKS and PEM files, which should be generated as explained in the documentation’s [Security SSL section](https://kafka.apache.org/documentation/#security_ssl). You can also simplify this process by running the [kafka-generate-ssl.sh](https://github.com/confluentinc/confluent-platform-security-tools/blob/master/kafka-generate-ssl.sh) script.

### Custom configuration

We have covered Kafka’s configuration parameters that have direct parallelism in our chart values, though as shown in the [official documentation](https://kafka.apache.org/documentation/#configuration), there are multiple parameters that Kafka supports not directly covered in the chart. Fortunately, you can configure any needed parameter you may need using any of the two options:

- Append the configuration directly to the node’s configuration file.
- Pass the configuration via environment variables.

> Configuration specified through environment variables takes preference over the one set via file.

#### Expand the configuration file

Each node takes its configuration from a `server.properties` file generated when the pod is initialized. A simple way to add extra configuration is to append any `key=value` pair directly to the `.properties` file using the `controller/broker.configuration` parameter. You can define this in a few ways, so let’s see a couple of examples:


```
# custom-values.yaml
# Using <nodeType> as a placeholder of controller/broker for readability
<nodeType>:
  configuration: |-
 log.retention.hours=72
 log.retention.ms=300
```


```
# custom-values.yaml
<nodeType>:
  configuration:
    log.retention.hours: 72
    log.retention.ms: 300
```


The `configuration` parameter also supports using an array to set a `key=value` pair in each entry. Whatever the method used, the chart will create a configmap with the defined configuration and append it to the `server.properties` once created.

> The chart supports different configurations for controller and broker nodes, so both `configuration` parameters when must be set when using both types of nodes.

#### Use environment variables

Apache Kafka retrieves configuration data from environment variables natively. This offers a new venue to configure Kafka when using containers, our preferred way. This will require a specific naming schema explained in the [documentation](https://kafka.apache.org/documentation/#env_var_config_provider).

We can review existing ENVs and add new ones under `<nodeType>.podTemplates.containers.<nodeType>.env`:


```
<nodeType>:
  podTemplates:
    containers:
      <nodeType>:
        env:
          ...
          KAFKA_LOG_RETENTION_HOURS:
            enabled: true
            values: '72'
          KAFKA_LOG_MS: '300'
```


### Persistence

Enabled by default, data persistence in the Apache Kafka chart affects data configuration and logs and is configured with the `persistence` parameter. You can define additional volumes to persist by appending them as follows:


```
<nodeType>:
  statefulset:
    volumeClaimTemplates:
      data:
        enabled: '{{ .Values.persistence.enabled }}'
      logs:
        enabled: '{{ .Values.persistence.enabled }}'
        volumeCount: '{{ int .Values.cluster.disksPerBroker }}'
      newVolume:
        enabled: '{{ .Values.persistence.enabled }}'
  podTemplates:
    containers:
      <nodeType>:
        volumeMounts:
          data:
            enabled: true
            mountPath: /mnt/kafka/data
          logs:
            enabled: true
            volumeCount: '{{ .Values.cluster.disksPerBroker }}'
            mountPath: /mnt/kafka/logs
          newVolume:
            enabled: true
            mountPath: /mnt/kafka/new_path
```


## Operations

Thanks to Apache Kafka architecture, running clusters can be easily modified using `helm upgrade`. Knowing this, the methods explained at [Custom configuration](index.html#custom-configuration) can be used to modify your already deployed cluster’s configuration. For specific cases, please check [Apache Kafka’s documentation](https://kafka.apache.org/documentation).

### Connect to the cluster using an Apache Kafka client

We will begin by deploying an Apache Kafka cluster comprising 3 controller and 3 broker nodes. Additionally, we will deploy a client from which to connect to the cluster. In the following example, we will use a separate client pod to perform validation checks:


```
helm upgrade --install <release-name> oci://dp.apps.rancher.io/charts/apache-kafka \
    --set broker.enabled=true \
    --set cluster.controllerBrokerRole=false
kubectl run apache-kafka-client --restart='Never' --image dp.apps.rancher.io/containers/apache-kafka:4.0 --command -- sleep infinity
```


To set up the client, we’ll need to consider the used security protocol and any authentication credentials needed. This configuration involves creating the `client.properties` configuration file. For a default chart installation, this means using the preset `SASL_PLAINTEXT` security protocol and configuring the user credentials defined in the `.Values.auth.plan.users` parameter.


```
$ kubectl exec -it apache-kafka-client -- bash
bash-4.4$ cat <<EOF > /tmp/client.properties
security.protocol=SASL_PLAINTEXT
sasl.mechanism=PLAIN
sasl.jaas.config=org.apache.kafka.common.security.scram.ScramLoginModule required username="user_test" password="password_test";
EOF
```


Once the client is configured, we can connect to the cluster:


```
bash-4.4$ kafka-features.sh \
    --bootstrap-server <release-name>-broker-headless.default.svc.cluster.local:9092 \
    --command-config /tmp/client.properties \
    describe
Feature: kraft.version SupportedMinVersion: 0 SupportedMaxVersion: 1 FinalizedVersionLevel: 0 Epoch: 2721
Feature: metadata.version SupportedMinVersion: 3.3-IV3 SupportedMaxVersion: 4.0-IV3 FinalizedVersionLevel: 4.0-IV3 Epoch: 860
```


> To connect to a controller node, you will need to adapt the preceding instructions by using admin credentials.

#### Run performance testing

A common test for checking your cluster’s health is to run performance tests. If your client is already configured, you can launch the test directly using `kubectl`:


```
$ kubectl exec -it apache-kafka-client -- kafka-producer-perf-test.sh \
    --topic tieredTopic \
    --num-records 1200 \
    --record-size 1024 \
    --throughput -1 \
    --producer-props bootstrap.servers=<release-name>-broker-headless.default.svc.cluster.local:9092 \
    --producer.config /tmp/client.properties
1200 records sent, 7643.312102 records/sec (7.46 MB/sec), 15.24 ms avg latency, 125.00 ms max latency, 16 ms 50th, 21 ms 95th, 22 ms 99th,
22 ms 99.9th
```


### Upgrade the chart

Chart upgradeability is paramount and can be affected by changes coming from two sources:

- Changes in Apache Kafka itself
- Changes in the chart templates

Although rare, the application of Apache Kafka can include changes from version to version (especially from one minor to the other) that may require manual intervention. This is well documented and can be accessed at the [Upgrade](https://kafka.apache.org/documentation/#upgrade) documentation section. Similarly, the chart’s template can suffer modifications that include breaking changes. This will always entail a bump to the chart’s major `version`.

Regardless of the source, breaking changes affecting the Apache Kafka chart will be documented in its `README` file. Any required manual steps will also be included.

### Uninstall the chart

Removing an installed Apache Kafka cluster is simple:


```
$ kubectl get pods -l app.kubernetes.io/instance=<release-name> -o name
pod/<release-name>-controller-0
pod/<release-name>-controller-1
pod/<release-name>-controller-2
$ helm uninstall <release-name>
```


Keep in mind PVCs won’t be removed unless you define the `<nodeType>.statefulset.persistentVolumeClaimRetentionPolicy.whenDeleted=Delete` parameter.


Last modified September 9, 2025


