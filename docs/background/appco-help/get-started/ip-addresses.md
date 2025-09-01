---
description: IP address ranges used by the Application Collection
lang: en
robots: index, follow
title: IP addresses \| SUSE Application Collection
twitter:card: summary
twitter:description: IP address ranges used by the Application Collection
twitter:title: IP addresses
viewport: width=device-width,initial-scale=1,shrink-to-fit=no
---


1.  [Get started](...md)
2.  IP addresses


# IP addresses


IP address ranges used by the Application Collection


The Application Collection serves its content from multiple IP address ranges. When accessing it behind a firewall or through a proxy that restricts the network traffic, you must allow TCP port 443 via our [IP ranges](index.html#ip-ranges) for the following domains:

| Service               | Domains                                             |
|-----------------------|-----------------------------------------------------|
| Web application       | `apps.rancher.io`                                   |
| Distribution platform | `dp.apps.rancher.io`, `europe-west3-docker.pkg.dev` |
| REST API              | `api.apps.rancher.io`                               |
| Documentation site    | `docs.apps.rancher.io`                              |

## IP ranges

You can retrieve the list of IP addresses used by the Application Collection from the [config](https://api.apps.rancher.io/v1/config) API endpoint.

These ranges are in [CIDR notation](https://en.wikipedia.org/wiki/Classless_Inter-Domain_Routing#CIDR_notation). You can use an online conversion tool to convert from CIDR to IP address ranges, like [CIDR to IPv4 Conversion](https://www.ipaddressguide.com/cidr) or [CIDR to IPv6 Conversion](https://www.ipaddressguide.com/ipv6-cidr).

These ranges are updated frequently. In case of allowing by IP address, we recommend regular monitoring of our API.


Last modified July 8, 2025


