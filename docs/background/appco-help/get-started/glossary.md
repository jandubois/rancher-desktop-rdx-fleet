---
description: A set of key terms every user of the Collection should familiarize with
lang: en
robots: index, follow
title: Glossary \| SUSE Application Collection
twitter:card: summary
twitter:description: A set of key terms every user of the Collection should familiarize with
twitter:title: Glossary
viewport: width=device-width,initial-scale=1,shrink-to-fit=no
---


1.  [Get started](...md)
2.  Glossary


# Glossary


A set of key terms every user of the Collection should familiarize with


### Access token

An access token is a string of characters used as an alternative to a password for authenticating into a system, typically for accessing APIs or other services. In Application Collection, you will need an access token for authenticating your [user account](index.html#user-account) in the REST API or in the Distribution Platform.

A user account can have several access tokens (also known as Personal Access Token or PAT). Once you have created your user account, you can generate access tokens for it from your [Profile page](https://apps.rancher.io/settings/access-tokens) in the web application.

By having several access tokens on your user account you can use different authentication keys in different services. This way, if one of the services gets compromised you don’t have to reset your password and update every other client: you just delete the compromised token and create a new one.

> All access tokens of a user account share the capabilities of this account, such as rate limits.

### Application

An application, or application software is a product that users **can install** into their environments to fulfill a necessity. This is the main piece of the collection.

An application can be a database, an API gateway, a load balancer, a runtime, etc. Most applications are cloud-native, but there are also containerized applications for specific purposes. For example, [Argo CD](https://apps.rancher.io/applications/argo-cd) (cloud-native application) or [Git](https://apps.rancher.io/applications/git) (containerized application).

Depending on the application type, it will be installed either as a **Helm chart** or as a **Single container**.

- Helm chart applications can have dependencies with other applications and/or [components](index.html#component). These dependencies can be mandatory or optional.
- Single container applications do not have any dependencies, neither with other applications nor with other components.

### Artifact

An artifact is the result of packaging the binaries of a component into a distributable unit.

There are 2 main artifact packaging formats:

- **Container image**: bundles the component binaries for a given version and flavor, on top of a base OS and architecture.
- **Helm chart**: contains pointers to the set of container images needed to run a specific application version and flavor.

Artifacts are continuously built, and updated through revisions.

### Branch

A branch is a set of versions where backwards compatibility is ensured among them. Each component follows its own branching strategy, as defined in the upstream project. It is assumed that the upstream project follows semantic version.

> Application Collection offers all branches available in the upstream project, prioritizing the LTS ones.

#### Inactive branches

Once the upstream project stops supporting a given branch, we mark it as *inactive*. This is also known as the branch “end of life” (EOL). An inactive branch should not get updates, thus it is recommended to update to a newer one as soon as possible. Note that, even being inactive, a branch could get updates:

- Because the upstream decided to release an exceptional update due to an important reason
- Because the base of a container image got an update

### Component

A component is an identifiable part of an [application](index.html#application) that provides a clear interface with other parts. The main difference between a component and an application is that a component cannot be installed stand-alone; it must be installed as part of an application.

> A component that can be installed on its own, with no dependencies to other applications or components, would become an application.

Let’s see a real example. [Apache APISIX](https://apps.rancher.io/applications/apache-apisix) is an open source, dynamic, scalable and high-performance cloud native API gateway, which uses *etcd* for storing configuration.

It offers an optional *Apache APISIX Dashboard* component that makes it as easy as possible for users to operate Apache APISIX through a front-end interface. Additionally, it is also possible to install it with the *Apache APISIX Ingress Controller* component (a [Kubernetes Ingress Controller](https://kubernetes.io/docs/concepts/services-networking/ingress-controllers/) that uses Apache APISIX as a reverse proxy).

In this case, *Apache APISIX* is an application which has a dependency with another application, *etcd*. Additionally, it has two optional dependencies with the *Apache APISIX Dashboard* and *Apache APISIX Ingress Controller* components.

Because *etcd* can be installed independently of *Apache APISIX*, it is not a component but an application.

![Apache APISIX components example](images/get-started/glossary-apisix-components.png "Apache APISIX components example")

### Flavor

Flavors, often referred to as *build flavors*, enable you to create multiple variations of your application that are tailored to different purposes or target environments. This allows to customize an application for different purposes while using the same core codebase.

For example, Application Collection offers the [OpenJDK](https://apps.rancher.io/applications/openjdk) application in two different flavors: default and `dev`. The `dev` flavor is specific for developers, including system packages that might not be necessary for production usage.

### Revision

A revision is an identifier that allows to distinguish different builds for the same version. Revisions can be triggered when:

- There is a change in the base image.
- Either a direct or indirect dependency is updated.

In Application Collection, revisions are provided as suffixes for a given version. They have the format `x.y.z`, where `x`, `y` and `z` contain only numeric characters and `y` and `z` are optional. For example, `envoy:1.33.3-6.44` represents the revision `6.44` of version `1.33.3` of `envoy`.

### Service account

Service accounts are a special type of account typically used by applications or IT services (rather than individual users) to perform tasks or access resources. Service accounts are often used for machine-to-machine interactions, such as running automated processes or accessing data.

Service accounts are not tied to a specific person but to an organization. In Application Collection, only the admins of an organization can create service accounts for it.

Service accounts can be created from the [Settings](https://apps.rancher.io/settings/service-accounts) section in the web application. When you create a service account, you’re provided with a unique username and a secret for it. These credentials can be used for authentication in the REST API and Distribution Platform.

> Service Accounts are not allowed to authenticate in the web application.

### User account

User accounts are associated with human identities, allowing individuals to access and interact with a system. In Application Collection, user accounts can be linked to one or more organizations and they inherit their permissions and capabilities from those organizations.

Application Collection is fully integrated for user management with [SUSE Customer Center](https://scc.suse.com/). Hence, the creation and management of user accounts is done there. Further information about how to create a user account can be found [here](../first-steps/index.html#how-can-i-get-an-account).

Once you have created your user account in SCC, you can use those credentials (username + password) to authenticate in the [web application](https://apps.rancher.io/). However, to interact with the REST API or the Distribution Platform you will need an [access token](index.html#access-token).


Last modified September 9, 2025


