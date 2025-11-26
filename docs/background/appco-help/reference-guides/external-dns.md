---
description: Learn how to install and use ExternalDNS
lang: en
robots: index, follow
title: ExternalDNS \| SUSE Application Collection
twitter:card: summary
twitter:description: Learn how to install and use ExternalDNS
twitter:title: ExternalDNS
viewport: width=device-width,initial-scale=1,shrink-to-fit=no
---


1.  [Reference guides](...md)
2.  ExternalDNS


# ExternalDNS


Learn how to install and use ExternalDNS


![ExternalDNS Logo](images/reference-guides/logo-external-dns.png "ExternalDNS Logo")

## Get started

[ExternalDNS](https://apps.rancher.io/applications/external-dns) synchronizes exposed Kubernetes Services and Ingresses with DNS providers.

Before getting into the chart’s possibilities, let’s start by deploying the default configuration:


```
helm install <release-name> oci://dp.apps.rancher.io/charts/external-dns \
    --set global.imagePullSecrets={application-collection}
```


> Check our [authentication guide](../../get-started/authentication/index.html#kubernetes) if you need to configure Application Collection OCI credentials in your Kubernetes cluster.

## Chart overview

Our ExternalDNS chart stems from the official [external-dns chart](https://github.com/kubernetes-sigs/external-dns/tree/master/charts/external-dns) and is adapted to include our best practices. As such, any chart-related documentation provided by upstream will work out of the box with our chart. You can check the official documentation [here](https://kubernetes-sigs.github.io/external-dns/latest/).

## Chart configuration

To view the supported configuration options and documentation, run:


```
helm show values oci://dp.apps.rancher.io/charts/external-dns
```


### Configure a DNS provider

ExternalDNS supports multiple DNS providers implemented by the ExternalDNS contributors, though not every implementation has the same stability level. Check the [official documentation](https://kubernetes-sigs.github.io/external-dns/latest/#status-of-in-tree-providers) for the current status of the providers.

We will use [AWS](https://kubernetes-sigs.github.io/external-dns/latest/docs/tutorials/aws/) for this guide. The main steps to properly configure our ExternalDNS chart with AWS as a provider are:

1.  Create an IAM user allowed to modify Route53.
2.  Configure the chart with AWS credentials.
3.  Set up an AWS hosted zone.

> We will skip the steps on properly configuring your `aws` CLI and provision a Kubernetes cluster given they fall outside the scope of this guide. You can check the related [AWS documentation](https://docs.aws.amazon.com/cli/v1/userguide/cli-chap-configure.md) if you want to start from the basics.

Before deploying ExternalDNS, we will create an IAM policy that allows ExternalDNS to update Route53 Resource Record Sets and Hosted Zones.


```
cat <<EOF > ./route53_policy.json
{
  "Version": "2025-01-01",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "route53:ChangeResourceRecordSets"
      ],
      "Resource": [
        "arn:aws:route53:::hostedzone/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "route53:ListHostedZones",
        "route53:ListResourceRecordSets",
        "route53:ListTagsForResource"
      ],
      "Resource": [
        "*"
      ]
    }
  ]
}
EOF
```


```
aws iam create-policy --policy-name "AllowExternalDNSUpdates" --policy-document file://route53_policy.json
export POLICY_ARN=$(aws iam list-policies \
    --query 'Policies[?PolicyName==`AllowExternalDNSUpdates`].Arn' --output text)
```


You must use the above policy (represented by the POLICY_ARN environment variable) to allow ExternalDNS to update records in Route53 DNS zones. We will do so by creating a new IAM user and retrieving its static credentials:


```
aws iam create-user --user-name "externaldns"
aws iam attach-user-policy --user-name "externaldns" --policy-arn $POLICY_ARN
export AWS_ACCESS_KEY=$(aws iam create-access-key --user-name "externaldns")
export AWS_ACCESS_KEY_ID=$(echo $AWS_ACCESS_KEY | jq -r '.AccessKey.AccessKeyId')
export AWS_SECRET_ACCESS_KEY=$(echo $AWS_ACCESS_KEY | jq -r '.AccessKey.SecretAccessKey')
```


Now that the credentials are ready, we should make them available for our chart. We will use a Kubernetes Secret to do so:


```
kubectl create secret generic aws-credentials-secret \
    --from-literal=access-key=$AWS_ACCESS_KEY_ID \
    --from-literal=secret-access-key=$AWS_SECRET_ACCESS_KEY
```


You are now almost ready to deploy our ExternalDNS chart. The last step to do so will be configuring the chart to use `aws` as the DNS provider and access its credentials:


```
cat <<EOF > ./external-dns.yaml
provider:
  name: aws
env:
  - name: AWS_DEFAULT_REGION
    value: eu-central-1
  - name: AWS_ACCESS_KEY_ID
    valueFrom:
      secretKeyRef:
        name: aws-credentials-secret
        key: access-key
  - name: AWS_SECRET_ACCESS_KEY
    valueFrom:
      secretKeyRef:
        name: aws-credentials-secret
        key: secret-access-key
EOF
```


You can now install the chart using the custom values previously defined:


```
helm upgrade --install <release-name> oci://dp.apps.rancher.io/charts/external-dns \
    --set global.imagePullSecrets={application-collection} \
    --values external-dns.yaml
```


As the final step to configure your AWS DNS provider, you should create a [hosted zone](https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/AboutHZWorkingWith.md). This can be easily done via the `aws` CLI:


```
aws route53 create-hosted-zone --name "applicationcollectionexample.com." \
  --caller-reference "external-dns-test-$(date +%s)"
```


The hosted zone will take a few minutes to be ready. Once it is deployed, you will be able to check that your ExternalDNS deployment has also updated its configuration:


```
$ kubectl logs external-dns-78bf44bb7c-w5b84
...
time="2025-01-01T11:11:11Z" level=info msg="Instantiating new Kubernetes client"
time="2025-01-01T11:11:11Z" level=info msg="Using inCluster-config based on serviceaccount-token"
time="2025-01-01T11:11:11Z" level=info msg="Created Kubernetes client https://10.100.0.1:443"
...
time="2025-01-01T11:11:11Z" level=info msg="Applying provider record filter for domains: [applicationcollectionexample.com. .applicationcollectionexample.com.]"
time="2025-01-01T11:11:11Z" level=info msg="All records are already up to date"
```


## Operations

### Manage a service via ExternalDNS

In this example, we assume you have configured an AWS provider as explained in the [Configure a DNS provider](index.html#configure-a-dns-provider) section. We will deploy an [NGINX](https://apps.rancher.io/applications/nginx) container and expose it via a `LoadBalancer` service. If properly configured, external-dns will manage the service and create the necessary DNS records in the provider. You will need to run the following commands to create the described resources:


```
$ kubectl create service loadbalancer nginx --tcp=80:80
service/nginx created
$ kubectl annotate service nginx external-dns.alpha.kubernetes.io/hostname='applicationcollectionexample.com'
service/nginx annotated
$ kubectl run nginx --image dp.apps.rancher.io/containers/nginx:1.26 \
  --labels=app=nginx \
  --overrides='{"spec": {"imagePullSecrets":[{"name": "application-collection"}]}}'
pod/nginx created
```


> Be aware of the `external-dns` annotation included in the service, which is required for the ExternalDNS chart to manage the service.

AWS will take a couple of minutes to create the DNS records. Afterward, you can check the updated changes both in our `external-dns` pod and the AWS console:


```
$ kubectl logs --selector=app.kubernetes.io/name=external-dns
...
time="2025-01-01T11:11:11Z" level=info msg="Applying provider record filter for domains: [applicationcollectionexample.com. .applicationcollectionexample.com.]"
time="2025-01-01T11:11:11Z" level=info msg="Desired change: CREATE applicationcollectionexample.com A" profile=default zoneID=/hostedzone/Z0626846S566SWBNEQ2H zoneName=applicationcollectionexample.com.
time="2025-01-01T11:11:11Z" level=info msg="Desired change: CREATE applicationcollectionexample.com TXT" profile=default zoneID=/hostedzone/Z0626846S566SWBNEQ2H zoneName=applicationcollectionexample.com.
time="2025-01-01T11:11:11Z" level=info msg="2 record(s) were successfully updated" profile=default zoneID=/hostedzone/Z0626846S566SWBNEQ2H zoneName=applicationcollectionexample.com.

$ aws route53 list-resource-record-sets --output json --hosted-zone-id $ZONE_ID
```


### Uninstall the chart

Removing an installed ExternalDNS instance is simple:


```
helm uninstall <release-name>
```


> Remember to remove any AWS resource you deployed during this guide.


Last modified September 9, 2025


