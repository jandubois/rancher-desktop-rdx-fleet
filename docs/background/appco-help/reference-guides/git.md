---
description: Learn how to run and use Git
lang: en
robots: index, follow
title: Git \| SUSE Application Collection
twitter:card: summary
twitter:description: Learn how to run and use Git
twitter:title: Git
viewport: width=device-width,initial-scale=1,shrink-to-fit=no
---


1.  [Reference guides](...md)
2.  Git


# Git


Learn how to run and use Git


![Git Logo](images/reference-guides/logo-git.png "git Logo")

## Get started

[Git](https://apps.rancher.io/applications/git) is a fast, scalable, distributed revision control system with an unusually rich command set that provides both high-level operations and full access to internals.

Before exploring the container’s possibilities, let’s start by deploying the default configuration:


```
docker run \
    --interactive \
    --tty \
    --rm \
    --name <container-name> \
    dp.apps.rancher.io/containers/git:2.51.2
```


> Check our [authentication guide](../../get-started/authentication/index.html#kubernetes) if you need to configure Application Collection OCI credentials in your Docker client.

## Container overview

Since there is no official upstream container for Git, our container is built from scratch using the SUSE Linux BCI Micro base image and following our best practices.

To run the Git container, execute the following command:


```
docker run \
    --interactive \
    --tty \
    --rm \
    --name <container-name> \
    --entrypoint "/bin/bash" \
    dp.apps.rancher.io/containers/git:2.51.2
```


Use the following commands inside the Git container shell to clone the OSC Git repository.


```
git clone https://github.com/openSUSE/osc.git /tmp/osc
```


Then, you can check that the repository was successfully cloned with:


```
ls -la /tmp/osc
```


## View unstaged changes

First, we’ll insert a change in the README file by executing the following command inside the Git container shell:


```
echo "This line was added for testing." >> /tmp/osc/README.md
```


Then, we can check all unstaged changes with the `git diff` command:


```
git -C /tmp/osc diff
```


The command should return the filename and the matching line, confirming the change is present in the file:


```
diff --git a/README.md b/README.md
index 034ada61..600342fa 100644
--- a/README.md
+++ b/README.md
@@ -181,3 +181,4 @@ to the [osc](https://github.com/openSUSE/osc/issues) project on GitHub.
 Unit tests can be run from a git checkout by executing
 
     python3 -m unittest -b
+This line was added for testing.
```


## Search repository content

After modifying the file, you can verify that the new content has been successfully added and is tracked by the Git repository using the `git grep` command. You will search for the unique phrase you inserted:


```
git -C /tmp/osc grep "This line was added for testing."
```


The command should return the filename and the matching line, confirming the change is present in the file:


```
README.md:This line was added for testing.
```


Last modified November 17, 2025


