---
description: Learn how to install and use ClamAV
lang: en
robots: index, follow
title: ClamAV \| SUSE Application Collection
twitter:card: summary
twitter:description: Learn how to install and use ClamAV
twitter:title: ClamAV
viewport: width=device-width,initial-scale=1,shrink-to-fit=no
---


1.  [Reference guides](...md)
2.  ClamAV


# ClamAV


Learn how to install and use ClamAV


![ClamAV Logo](images/reference-guides/logo-clamav.png "ClamAV Logo")

## Get started

[ClamAV](https://apps.rancher.io/applications/clamav) is an open-source antivirus engine for detecting trojans, viruses, malware & other malicious threats.

Before exploring the container’s possibilities, let’s start by deploying the default configuration:


```
docker run \
    --interactive \
    --tty \
    --rm \
    --name <container-name> \
    dp.apps.rancher.io/containers/clamav:1.4.2
```


> Check our [authentication guide](../../get-started/authentication/index.html#kubernetes) if you need to configure Application Collection OCI credentials in your Docker client.

## Container overview

Our container is based on the official [ClamAV](https://github.com/Cisco-Talos/clamav-docker/tree/main/clamav/1.4/debian) container and adapted to include our best practices. As such, any container-related documentation provided by upstream will work out of the box with our container. You can check the official documentation [here](https://docs.clamav.net/manual/Installing/Docker.md).

## Container configuration

By default, the ClamAV container launches both the `freshclam` and `clamd` daemons. To customize how these services operate, you can supply environment variables using the `--env` (or `-e`) parameter when executing the `docker run` command. The following environment variables are available:

- `CLAMAV_NO_CLAMD`: Set to `true` to prevent the `clamd` daemon from starting. By default, `clamd` is started.
- `CLAMAV_NO_FRESHCLAMD`: Set to `true` to prevent the `freshclam` daemon from starting. By default, `freshclam` is started.
- `CLAMD_STARTUP_TIMEOUT`: Integer that defines the number of seconds to wait for the `clamd` daemon to start. The default is 1800 seconds.
- `FRESHCLAM_CHECKS`: Integer that specifies how many times per day `freshclam` checks for updates. The default is once per day.

> Even if you disable the `freshclam` daemon, it will still run at least once when the container starts if no virus database is present.

### Modify configuration files

#### Using volume mounts

You can modify any of the configuration files located in `/etc/clamav` by using volume mounts. This is achieved by adding the `--mount` argument to the `docker run` command. The following example demonstrates how to mount an entire ClamAV configuration directory. However, you can specify the `--mount` argument multiple times to replace individual configuration files as needed:


```
docker run --rm \
    --interactive \
    --tty \
    --rm \
    --mount type=bind,source=/full/path/to/clamav/,target=/etc/clamav \
    --name <container-name> \
    dp.apps.rancher.io/containers/clamav:1.4.2
```


#### Using environment variables

You can dynamically configure ClamAV and FreshClam by passing environment variables with specific prefixes when starting the container. These variables are automatically applied to their respective configuration files (`/etc/clamav/clamd.conf` for ClamAV and `/etc/clamav/freshclam.conf` for FreshClam). To update ClamAV and FreshClam configurations using environment variables, run the container with the `-e` flag:


```
docker run --rm \
    -e CLAMD_CONF_LogTime=no \
    -e CLAMD_CONF_MaxThreads=5 \
    -e FRESHCLAM_CONF_Checks=24 \
    dp.apps.rancher.io/containers/clamav:1.4.2
```


This command will result in the following configurations within the container:

- `/etc/clamav/clamd.conf`:

  

  ```
  LogTime no
  MaxThreads 5
  ```

  

- `/etc/clamav/freshclam.conf`:

  

  ```
  Checks 24
  ```

  

The container’s startup script processes these environment variables, either replacing existing configuration keys or adding new ones to the respective `.conf` files.

- **Prefix:** Use `CLAMD_CONF_` for ClamAV settings and `FRESHCLAM_CONF_` for FreshClam settings.
- **Key/Value Mapping:** The part of the environment variable name following the prefix is treated as the configuration key, and the variable’s value is used as the setting in the corresponding configuration file.
  - For example, `CLAMD_CONF_LogTime=no` translates to `LogTime no` in `clamd.conf`.
  - Similarly, `FRESHCLAM_CONF_Checks=24` becomes `Checks 24` in `freshclam.conf`.

> For more information about the configuration files’s settings, check the upstream documentation about [clamd.conf](https://docs.clamav.net/manual/Usage/Configuration.html?#clamdconf) and [freshclam.conf](https://docs.clamav.net/manual/Usage/Configuration.html?#freshclamconf).

### Run clamd using non-root user

To enhance security, you can run a ClamAV container as the non-root user “clamav” by utilizing an unprivileged entrypoint script. To achieve this with Docker, include the `--user "clamav"` and `--entrypoint /init-unprivileged` options in your `docker run` command.

Here’s an example:


```
docker run -it --rm \
    --user "clamav" \
    --entrypoint /init-unprivileged \
    dp.apps.rancher.io/containers/clamav:1.4.2
```


### Run clamscan

To execute `clamscan` within a Docker container, you can use the following `docker run` command structure:


```
docker run -it --rm \
    --mount type=bind,source=/path/to/scan,target=/scandir \
    dp.apps.rancher.io/containers/clamav:1.4.2 \
    clamscan /scandir
```


However, be aware that this method utilizes the virus signatures included in the Docker image, which might not be up-to-date. For a more effective scanning using the latest signatures, it is recommended to incorporate a dedicated Docker volume for the virus databases. Here’s an example of how to mount a database volume:


```
docker run -it --rm \
    --mount type=bind,source=/path/to/scan,target=/scandir \
    --mount type=bind,source=/path/to/databases,target=/var/lib/clamav \
    dp.apps.rancher.io/containers/clamav:1.4.2 \
    clamscan /scandir
```


## Operations

### Stop and remove the container

To stop the running ClamAV container, use this command:


```
docker stop <container-name>
```


To then remove the stopped container, execute:


```
docker rm <container-name>
```


Last modified September 9, 2025


