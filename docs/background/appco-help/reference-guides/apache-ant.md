---
description: Learn how to install and use Apache Ant
lang: en
robots: index, follow
title: Apache Ant \| SUSE Application Collection
twitter:card: summary
twitter:description: Learn how to install and use Apache Ant
twitter:title: Apache Ant
viewport: width=device-width,initial-scale=1,shrink-to-fit=no
---


1.  [Reference guides](...md)
2.  Apache Ant


# Apache Ant


Learn how to install and use Apache Ant


![Apache Ant Logo](images/reference-guides/logo-apache-ant.png "Apache Ant Logo")

## Get started

[Apache Ant](https://apps.rancher.io/applications/apache-ant) is a versatile, Java-based build tool from the Apache Software Foundation. Similar to the make utility, Ant automates software build processes, such as compiling, testing, and assembling applications.

Before exploring the container’s possibilities, let’s start by deploying the default configuration:


```
docker run \
    --interactive \
    --tty \
    --rm \
    --name <container-name> \
    --entrypoint /bin/bash \
    dp.apps.rancher.io/containers/apache-ant:1.10.15-openjdk11
```


> Check our [authentication guide](../../get-started/authentication/index.html#kubernetes) if you need to configure Application Collection OCI credentials in your Docker client.

## Container overview

Since there is no official upstream container for Apache Ant, our container is built from scratch using a BCI Micro and includes our best practices.

### Flavors

It is provided in three flavors based on the included OpenJDK version:

- OpenJDK 11
- OpenJDK 17
- OpenJDK 21

## Container configuration

The container’s build environment can be configured at runtime using volume mounts, command-line flags, and environment variables.

### Basic set up

The most fundamental configuration is providing your project’s `build.xml` file. This is done by mounting your project directory from the host into the container and setting it as the working directory.


```
docker run \
    --interactive \
    --tty \
    --rm \
    -v /path/to/your/project:/src \
    --name <container-name> \
    -w /src \
    dp.apps.rancher.io/containers/apache-ant:1.10.15-openjdk17 \
    <ant-target>
```


### Passing build properties

You can control build behavior without modifying the `build.xml` file by passing properties with the `-D` flag. This method sets a user property that can be used for conditional logic or for value substitution (using `${property.name}`) within your project’s build.xml file. Any property set this way from the command line will override a property of the same name defined within the build file.


```
docker run \
    --interactive \
    --tty \
    --rm \
    -v /path/to/your/project:/src \
    --name <container-name> \
    -w /src \
    dp.apps.rancher.io/containers/apache-ant:1.10.15-openjdk17 \
    -Dbuild.version=1.0.0
```


> This is a core feature of Apache Ant itself. The official documentation for using command-line arguments can be found in the Apache Ant [Manual](https://ant.apache.org/manual/). For a list of standard properties automatically provided by Ant (such as `ant.version` or `basedir`), see the Built-in Properties [documentation](https://ant.apache.org/manual/properties.md).

Alternatively, you can set default arguments that will be used for every run by using the `ANT_ARGS` environment variable.


```
docker run \
    --interactive \
    --tty \
    --rm \
    -v /path/to/your/project:/src \
    -e ANT_ARGS="-Dbuild.version=1.0.0 -listener org.apache.tools.ant.NoBannerLogger" \
    --name <container-name> \
    -w /src \
    dp.apps.rancher.io/containers/apache-ant:1.10.15-openjdk17
```


### Setting JVM options

You can pass arguments directly to the Java Virtual Machine (JVM) by setting the `ANT_OPTS` environment variable. This is commonly used to adjust memory settings, like increasing the available memory


```
docker run \
    --interactive \
    --tty \
    --rm \
    -v /path/to/your/project:/src \
    -e ANT_OPTS="-Xmx2g" \
    --name <container-name> \
    -w /src \
    dp.apps.rancher.io/containers/apache-ant:1.10.15-openjdk17
```


> The `ANT_OPTS` environment variable is the standard method for passing options to the JVM that runs Ant. This is documented in the Environment Variables section of the Apache Ant [Manual](https://ant.apache.org/manual/running.md).

## Operations

### Stop and remove the container

To stop the running Apache Ant container, use this command:


```
docker stop <container-name>
```


To then remove the stopped container, execute:


```
docker rm <container-name>
```


Last modified July 21, 2025


