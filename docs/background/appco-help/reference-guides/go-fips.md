---
description: Learn how to install and use Go FIPS
lang: en
robots: index, follow
title: Go FIPS \| SUSE Application Collection
twitter:card: summary
twitter:description: Learn how to install and use Go FIPS
twitter:title: Go FIPS
viewport: width=device-width,initial-scale=1,shrink-to-fit=no
---


1.  [Reference guides](...md)
2.  Go FIPS


# Go FIPS


Learn how to install and use Go FIPS


![Go Logo](images/reference-guides/logo-go-fips.png "Go Logo")

## Get started

[Go](https://apps.rancher.io/applications/go-fips) is an open source programming language that makes it easy to build simple, reliable, and efficient software. This is a modified version of Go enabling it to call into OpenSSL for FIPS compliance.

Before exploring the container’s possibilities, let’s start by deploying the default configuration:


```
docker run \
    --interactive \
    --tty \
    --rm \
    --name <container-name> \
    dp.apps.rancher.io/containers/go-fips:1.25.0.1
```


> Check our [authentication guide](../../get-started/authentication/index.html#kubernetes) if you need to configure Application Collection OCI credentials in your Docker client.

## Container overview

Our container is based on the [Microsoft builds of Go](https://github.com/microsoft/go), which is a modified version of the [Go programming language](https://github.com/golang/go) which enables it to call into OpenSSL for FIPS compliance, and adapted to include our best practices. As such, any container-related documentation provided by upstream will work out of the box with our container. You can check the [official documentation](https://github.com/microsoft/go/blob/microsoft/main/eng/doc/fips/UserGuide.md).

### Flavors

The container image is provided in the following flavors:

- Default flavor: This flavor of the container image is based on SUSE Linux BCI Micro FIPS base image and includes only the essential system packages **to run Go FIPS and build applications**. Therefore, it lacks the package manager and various popular build tools such as `curl`, `find` or `grep`. It is ideal if you are looking for a minimal image to build your Go application.
- Development flavor `dev`: This flavor is based on SUSE Linux BCI Base FIPS and includes the `zypper` package manager, the `rpm` packaging tool, and various different build tools such as `curl`, `find`, `grep`. Therefore, it is ideal for build pipelines that need extra programs **to build your application**.

## Container configuration

The Go FIPS container, like the official container images, does not specify any entrypoint to run the container image. It is up to the end user to run any specific programs within the container image.

Compared to standard Go container images, this container image is configured with the following additional environment variables, to enable OpenSSL calls for FIPS compliance:

- `GOEXPERIMENT` set to `opensslcrypto`, to instruct Go to use OpenSSL as back-end for its cryptographic library.
- `GOFLAGS` set to `-tags=requirefips`, to make built programs always require FIPS mode, and panic if it is not enabled.

> You must not override any of the above environment variables when using Go FIPS, or it could potentially result in built programs not to be FIPS compliant.

## Container usage

We will describe how you can use the Go FIPS container image to generate a binary that is FIPS compliant, and how you can create a container image that runs this FIPS-compliant program.

### Build a FIPS-compliant program

You can use the below example to build a FIPS-compliant program, which starts a basic HTTPS server on port 8443 and uses the SSL/TLS certificate and certificate key files at `cert.pem` and `key.pem`, respectively, in the same directory as the server:


```
package main

import (
    "crypto/tls"
    "fmt"
    "log"
    "net/http"
)

func main() {
    // Minimal HTTPS handler
    handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        fmt.Fprintf(w, "Hello world!\n")
    })

    // Minimal HTTPS server configuration
    server := &http.Server{
        Addr:      ":8443",
        Handler:   handler,
        TLSConfig: &tls.Config{
            MinVersion: tls.VersionTLS12, // FIPS minimum TLS version
        },
    }

    // Start HTTPS server using existing TLS/SSL certificates
    log.Println("Starting HTTPS server on https://localhost:8443")
    certFile := "cert.pem"
    keyFile := "key.pem"
    err := server.ListenAndServeTLS(certFile, keyFile)
    if err != nil {
        log.Fatalf("Server failed: %v", err)
    }
}
```


> You can generate a self-signed SSL/TLS certificate (`cert.pem`) with a certificate key file (`key.pem`) with the following command in the same directory as the previous HTTPS server program:
>
> 
>
> ```
> openssl req -x509 -newkey rsa:2048 -nodes -keyout key.pem -out cert.pem -days 365 -subj "/CN=localhost"
> ```
>
> 

To build the program, run the following command in the Go FIPS container image. In the below example, let’s assume the source code was added to the `server.go` file:


```
go build -o server server.go
```


To optimize the binary further, you can remove debug symbols:


```
go build -ldflags '-s -w' -o server server.go
```


> If you remove debug symbols, it will not be possible to check if the binary contains FIPS symbols with `go tool nm`.

You can then proceed to run the program and ensure that it works as expected. To exit, press \`Ctrl+C:


```
$ ./server
2025/07/04 15:43:24 Starting HTTPS server on https://localhost:8443
^C
```


### Verify that a program is FIPS-enabled

There are several things you can do to verify that a binary is FIPS-enabled, if it was built with the Go FIPS toolchain.

#### Static checks

- Check that the binary contains FIPS symbols. You can use the environment variable `LD_DEBUG=symbols` or the tool `go tool nm`:

  

  ```
  $ LD_DEBUG=symbols ./server 2>&1 | grep -Ei '(ssl|crypto|fips)'
         157: symbol=_ITM_deregisterTMCloneTable;  lookup in file=/usr/lib64/libcrypto.so.3 [0]
         157: symbol=__gmon_start__;  lookup in file=/usr/lib64/libcrypto.so.3 [0]
         157: symbol=_ITM_registerTMCloneTable;  lookup in file=/usr/lib64/libcrypto.so.3 [0]
  $ go tool nm ./server | grep -i fips | head -n 10
     14f38 T _cgo_7856f5258810_Cfunc_go_openssl_EVP_default_properties_enable_fips
     14f90 T _cgo_7856f5258810_Cfunc_go_openssl_EVP_default_properties_is_fips_enabled
     14fe8 T _cgo_7856f5258810_Cfunc_go_openssl_FIPS_mode
     15038 T _cgo_7856f5258810_Cfunc_go_openssl_FIPS_mode_set
     151f8 T _cgo_7856f5258810_Cfunc_go_openssl_fips_enabled
    5f1910 D _g_EVP_default_properties_enable_fips
    5f1918 D _g_EVP_default_properties_is_fips_enabled
    5f1920 D _g_FIPS_mode
    5f1928 D _g_FIPS_mode_set
    399640 R crypto/ecdsa..dict.privateKeyToFIPS[*crypto/internal/fips140/nistec.P224Point]
  ```

  

  > If the symbols were removed at build time, these commands will not show any symbol.

- Check compilation flags for FIPS configuration. You can run `go version -m` on the binary to check that it includes the expected configuration to enable FIPS:

  

  ```
  $ go version -m ./server | grep -Ei '(ssl|crypto|fips)'
  ./server: go1.25.0 X:opensslcrypto
    build microsoft_systemcrypto=1
    build -tags=requirefips
    build GOEXPERIMENT=opensslcrypto
  ```

  

> The `grep` command is only available in the `dev` flavor of the Go FIPS container image.

#### Functional test

Execute the following commands in your environment:


```
echo 'Allowed cipher/TLS combo:'
curl --ciphers ECDHE-RSA-AES256-GCM-SHA384 --insecure https://localhost:8443
echo
echo 'Disallowed cipher/TLS combo:'
curl --ciphers ECDHE-RSA-CHACHA20-POLY1305 --tls-max 1.2 --insecure https://localhost:8443
```


If you execute the above commands in a FIPS-enabled environment, and in an environment where it is not enforced, you will see different results:

- In a FIPS-enabled environment, the first request succeeds with the allowed cipher/TLS combination, and the latter will fail because the cipher/TLS combination is not allowed according to the FIPS 140-2 specification:

  

  ```
  Allowed cipher/TLS combo:
  Hello world!

  Disallowed cipher/TLS combo:
  curl: (35) OpenSSL/3.1.4: error:0A000410:SSL routines::sslv3 alert handshake failure
  ```

  

- In an environment which is not enforcing FIPS, both requests will succeed because there isn’t any limitation on the allowed cipher/TLS combinations:

  

  ```
  Allowed cipher/TLS combo:
  Hello world!

  Disallowed cipher/TLS combo:
  Hello world!
  ```

  

### Create a FIPS-enabled container image with a FIPS-compliant program

You can use the following Dockerfile to create a container image for the previous example:


```
FROM dp.apps.rancher.io/containers/bci-micro-fips:15.6

COPY server /

ENTRYPOINT [ "/server" ]
```


Execute the following command to build the container image:


```
docker build -t IMAGE_NAME:latest .
```


Then, you can use the following command to start the container, exposing the service to port 8443 and mounting the certificate key and file:


```
$ docker run -p 8443:8443 -v ./cert.pem:/cert.pem -v ./key.pem:/key.pem --rm -ti CONTAINER_NAME
2025/07/04 16:34:34 Starting HTTPS server on https://localhost:8443
```


In a separate shell session, you can verify that the server works:


```
curl --insecure https://localhost:8443
```


Finally, you can proceed to distribute the container image to your desired container image registry.

### Limitations

- CGo builds are necessary to generate FIPS-enabled binaries. I.e., `CGO_ENABLED` must never be disabled.
- Programs built with Go FIPS are not linked dynamically to OpenSSL, but the library is loaded at runtime with Go’s `dlopen`. Therefore, you must run the resulting binary in an environment which contains a compatible OpenSSL image, such as the SLE BCI FIPS-140-2 container images as suggested in the previous section.
- To enforce FIPS mode, it must be done in the host system that runs the container image. If you are using SUSE Linux Enterprise, you can follow [this guide](https://www.suse.com/support/kb/doc/?id=000019432) to enable strict FIPS mode.
- Quoting from [golang-fips/openssl](https://github.com/golang-fips/openssl?tab=readme-ov-file#disclaimer), which this project is based on: A program directly or indirectly using this package in FIPS mode can claim it is using a FIPS-certified cryptographic module (OpenSSL), but it can’t claim the program as a whole is FIPS certified without passing the certification process, nor claim it is FIPS compliant without ensuring all `crypto` APIs and workflows are implemented in a FIPS-compliant manner.


Last modified November 17, 2025


