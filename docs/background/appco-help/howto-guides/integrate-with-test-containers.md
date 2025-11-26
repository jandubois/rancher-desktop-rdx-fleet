---
description: Use Application Collection as a private registry for Testcontainers images
lang: en
robots: index, follow
title: Integrate with Testcontainers \| SUSE Application Collection
twitter:card: summary
twitter:description: Use Application Collection as a private registry for Testcontainers images
twitter:title: Integrate with Testcontainers
viewport: width=device-width,initial-scale=1,shrink-to-fit=no
---


1.  [How-to guides](...md)
2.  Integrate with Testcontainers


# Integrate with Testcontainers


Use Application Collection as a private registry for Testcontainers images


[Testcontainers](https://testcontainers.com/) is a testing library that provides easy and lightweight APIs for bootstrapping integration tests with real services wrapped in Docker containers.

## Testcontainers overview

Testcontainers allows you to write tests that depend on the same services you use in production without mocks or in-memory services.

A typical Testcontainers-based integration test works as follows:

- Before tests:
  - Start your required services (databases, messaging systems, etc) Docker containers using Testcontainers API.
  - Configure or update your application configuration to use these containerized services.
- During tests:
  - Your tests will run using these containerized services.
- After tests:
  - Testcontainers will take care of destroying those containers irrespective of whether tests executed successfully or there are any tests failures.

    ![Testcontainers workflow](images/howto-guides/testcontainers-workflow.png "Testcontainers workflow")

### Why using Application Collection with Testcontainers?

With Testcontainers, you can run your tests in an isolated and controlled environment that closely resembles your production setup, ensuring that your tests are reliable and reproducible.

Hence, if you are using Application Collection images in your Production environment, wouldn’t it be great to use the exactly same images in your integration tests?

By default, Testcontainers pulls the images for the containerized services from Docker Hub, but it also allows configuring a private registry instead. This is known as [Image name substitution](index.html#image-name-substitution) and it is the mechanism that will be used to integrate with Application Collection.

## Image name substitution

Image name substitution allows the replacement of an image name specified in your test code with an alternative name. This can be used to replace the name of a Docker Hub image dependency with an alternative hosted on a private image registry.

Testcontainers offers several approaches for image name substitution:

- Manual substitution, which does not rely on an automated approach
- Using an Image Name Substitutor:
  - Automatically modifying Docker Hub image names
  - Developing a custom function for transforming image names on the fly
  - Overriding image names individually in configuration

When choosing the best approach for configuring Application Collection as the private registry to be used by Testcontainers in your application, we must take into account that Testcontainers does not only pull the images directly used in your tests, but it also pulls other images needed to support internal functionality:

- `testcontainers/ryuk` - performs fail-safe cleanup of containers. It is always required unless [Ryuk is disabled](https://java.testcontainers.org/features/configuration/#disabling-ryuk)
- `alpine` - used to check whether images can be pulled at startup. It is always required unless [startup checks are disabled](https://java.testcontainers.org/features/configuration/#disabling-the-startup-checks)
- `testcontainers/sshd` - required if [exposing host ports to containers](https://java.testcontainers.org/features/networking/#exposing-host-ports-to-the-container)
- `testcontainers/vnc-recorder` - required if using [Webdriver containers](https://java.testcontainers.org/modules/webdriver_containers/) and using the screen recording feature
- `docker/compose` - required if using [Docker Compose](https://java.testcontainers.org/modules/docker_compose/)
- `alpine/socat` - required if using [Docker Compose](https://java.testcontainers.org/modules/docker_compose/)

When configuring a private registry, the chosen registry should host all the Docker images that the build requires. Currently, Application Collection does not host the images needed by Testcontainers to support internal functionality. For this reason, it is recommended to use a *Manual substitution*, pulling from Application Collection only the test images and relying on Docker Hub for the rest.

### Configure *Manual substitution*

This approach consists on modifying the test code manually, referring directly in the test to an image on the Application Collection registry.

With the default configuration, a test that uses a `postgresql` container image will pull it from Docker Hub.


```
// Referring directly to an image on Docker Hub
final PostgreSQLContainer<?> postgreSQLContainer = new PostgreSQLContainer<>("postgres:15.5")
  .withDatabaseName("my-database")
  .withUsername("user")
  .withPassword("pass");
postgreSQLContainer.start()

//Use it for testing
```


Configuring your test to pull the image from Application Collection is as simple as:


```
// Referring directly to an image on Application Collection
final PostgreSQLContainer<?> postgreSQLContainer = new PostgreSQLContainer<>("dp.apps.rancher.io/containers/postgresql:15.5-3.1")
  .asCompatibleSubstituteFor("postgres"))
    .withDatabaseName("my-database")
    .withUsername("user")
    .withPassword("pass");
postgreSQLContainer.start()

//Use it for testing
```


### Handle authentication

Testcontainers automatically extracts the Docker registry from the image name and, for that registry, it tries to locate the proper authentication.

Authentication for Application Collection should be defined in the following format:


```
{
  "auths": {
    "dp.apps.rancher.io": {
      "auth": "[base64 output]"
    }
  }
}
```


Where the `base64` output can be generated by a opening a console and typing:


```
echo -n "<your-username-or-sa-username>:<access-token-or-sa-secret>" | base64
```


The above authentication can be passed to Testcontainers in any of the following ways:

1.  Defining a `DOCKER_AUTH_CONFIG` environment variable and setting the value to the above code snippet.

2.  Creating a `config.json` file, setting its content to the above code snippet and defining a `DOCKER_CONFIG` environment variable pointing to the path of that file.

3.  Adding the above code snippet to the default Docker configuration file, which lives in the user’s home (`~/.docker/config.json`). Alternatively, you can let Docker automatically add your credentials to the default configuration file by login to the registry.

    

    ```
    docker login dp.apps.rancher.io -u <your-username-or-sa-username> -p <access-token-or-sa-secret>
    ```

    

## Hands-on example

This section contains a hands-on example on how to set up a Hello world Spring Boot project with Testcontainers and integrate with Application Collection.

### Create the project

To create the project, we will make use of Spring Boot project [Spring Initializr](https://start.spring.io/).

Our *Hello world* project will use *Maven* as build tool, *Java 17* and will make use of *Spring Web*, *Spring Data JPA*, *PostgreSQLDriver* and *Testcontainers* dependencies.

![Project configuration](images/howto-guides/testcontainers-project-configuration.png "Project configuration")

This will generate a project ready to be imported in your favorite IDE with all the necessary dependencies added to the `pom.xml` file.


```
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
  <modelVersion>4.0.0</modelVersion>
  <parent>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-parent</artifactId>
    <version>3.2.5</version>
    <relativePath/> <!-- lookup parent from repository -->
  </parent>
  <groupId>com.suse.rancher.apps.demo</groupId>
  <artifactId>testcontainers</artifactId>
  <version>0.0.1-SNAPSHOT</version>
  <name>ApplicationCollection</name>
  <description>Demo project for integration Testcontainers with Application Collection</description>
  <properties>
    <java.version>17</java.version>
  </properties>
  <dependencies>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-data-jpa</artifactId>
  </dependency>
  <dependency>
    <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-web</artifactId>
  </dependency>

  <dependency>
    <groupId>org.postgresql</groupId>
    <artifactId>postgresql</artifactId>
    <scope>runtime</scope>
  </dependency>

  <dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-test</artifactId>
    <scope>test</scope>
  </dependency>
  <dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-testcontainers</artifactId>
    <scope>test</scope>
  </dependency>
  <dependency>
    <groupId>org.testcontainers</groupId>
    <artifactId>junit-jupiter</artifactId>
    <scope>test</scope>
  </dependency>
  <dependency>
    <groupId>org.testcontainers</groupId>
    <artifactId>postgresql</artifactId>
    <scope>test</scope>
  </dependency>
  </dependencies>

  <build>
    <plugins>
      <plugin>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-maven-plugin</artifactId>
      </plugin>
    </plugins>
  </build>
</project>
```


### Create a JPA entity and repository

First thing we will create in our project is a JPA entity `UserEntity.java` that we will place inside a `model` package.


```
package com.suse.rancher.apps.demo.testcontainers.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "user_info")
public class User {

  @GeneratedValue(strategy = GenerationType.IDENTITY)
  @Id
  private Long id;

  @Column(nullable = false)
  private String name;

  @Column(nullable = false, unique = true)
  private String email;

  public User() {
  }

  public User(final Long id, final String name, final String email) {
    this.id = id;
    this.name = name;
    this.email = email;
  }

  public Long getId() {
    return id;
  }

  public void setId(final Long id) {
    this.id = id;
  }

  public String getName() {
    return name;
  }

  public void setName(final String name) {
    this.name = name;
  }

  public String getEmail() {
    return email;
  }

  public void setEmail(final String email) {
    this.email = email;
  }
}
```


Additionally, we will create a JPA repository for our User entity and place it in a `repository` package. This will provide CRUD operations, sorting and pagination capabilities and dynamic query generation from method names.


```
package com.suse.rancher.apps.demo.testcontainers.repository;

import com.suse.rancher.apps.demo.testcontainers.model.User;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserRepository extends JpaRepository<User, Long> {
  
}
```


### Add the schema creation script

In this step we will add scripts for creating the Postgres database. Ideally, we should use a database migration tool like[Flyway](https://flywaydb.org/). However, to keep things as simple as possible we will use simple schema initialization support provided by Spring Boot.

For that, we will create the following `schema.sql` file under the `src/main/resources` directory.


```
CREATE TABLE user_info (
  id SERIAL NOT NULL,
  name VARCHAR NOT NULL,
  email VARCHAR NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (email)  
);
```


And we will enable schema initialization by adding the following property in the `src/main/resources/application.properties` file.


```
spring.sql.init.mode=always
```


### Create a REST API endpoint

Finally, we will create an `api` package with a controller to implement a REST API endpoint that fetches all customers from the database.


```
package com.suse.rancher.apps.demo.testcontainers.api;

import com.suse.rancher.apps.demo.testcontainers.model.User;
import com.suse.rancher.apps.demo.testcontainers.repository.UserRepository;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class UserController {
  
  private final UserRepository userRepository;
  
  UserController(final UserRepository userRepository) {
    this.userRepository = userRepository;
  }
  
  @GetMapping("/api/users")
  List<User> getAll() {
    return userRepository.findAll();
  }
}
```


### Write tests

Finally, we will write an integration test for the REST API `GET /api/users` endpoint. Our test will make use of:

- Spring MVC Test framework (`MockMVC`) to perform the requests and verify the responses

- `AssertJ` to perform assertions on the responses. This requires the following dependency needs to be added to the `pom.xml` file:

  

  ```
  <dependency>
    <groupId>org.assertj</groupId>
    <artifactId>assertj-core</artifactId>
    <version>3.25.3</version>
    <scope>test</scope>
  </dependency>
  ```

  

- `Testcontainers` to spin up a Postgres database instance as a Docker container identical to the one used in production

Our test class will look as follows:


```
package com.suse.rancher.apps.demo.testcontainers;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.suse.rancher.apps.demo.testcontainers.api.UserController;
import com.suse.rancher.apps.demo.testcontainers.model.User;
import com.suse.rancher.apps.demo.testcontainers.repository.UserRepository;
import java.lang.reflect.Type;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.jdbc.JdbcDatabaseDelegate;
import org.testcontainers.utility.DockerImageName;

@SpringBootTest()
class UserControllerIT {

  private static final PostgreSQLContainer<?> POSTGRESQL_CONTAINER;

  private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper()
    .registerModule(new JavaTimeModule());

  static {
    POSTGRESQL_CONTAINER = new PostgreSQLContainer<>(
      DockerImageName.parse("dp.apps.rancher.io/containers/postgresql:15.5-3.1")
        .asCompatibleSubstituteFor("postgres"))
          .withDatabaseName("demo")
          .withUsername("demo")
          .withPassword("pass");
    POSTGRESQL_CONTAINER.start();
  }

  @Autowired
  UserController userController;

  @Autowired
  UserRepository userRepository;

  private MockMvc mockMvc;

  @DynamicPropertySource
  public static void setProperties(final DynamicPropertyRegistry registry) {
    registry.add("spring.datasource.url", POSTGRESQL_CONTAINER::getJdbcUrl);
    registry.add("spring.datasource.username", POSTGRESQL_CONTAINER::getUsername);
    registry.add("spring.datasource.password", POSTGRESQL_CONTAINER::getPassword);
  }

  @BeforeEach
  @Transactional
  void setup() {
    mockMvc = MockMvcBuilders.standaloneSetup(userController).build();

  final List<User> users = List.of(
    new User(null, "Peter", "peter@mail.com"),
    new User(null, "Lisa", "lisa@mail.com")
  );

  userRepository.saveAll(users);
  }

  @AfterEach
  @Transactional
  void cleanup() {
    userRepository.deleteAll();
  }

  @DisplayName("When calling the users endpoint then all users are returned")
  @Test
  void getAllUsers() throws Exception {
    final MvcResult result = mockMvc.perform(MockMvcRequestBuilders.get("/api/users"))
      .andExpect(status().isOk())
      .andReturn();

    final List<User> obtainedUsers = OBJECT_MAPPER.readValue(result.getResponse().getContentAsString(), new TypeReference<List<User>>() {});

    assertThat(obtainedUsers).hasSize(2);
    assertThat(obtainedUsers).extracting("name").containsExactlyInAnyOrder("Peter", "Lisa");
    assertThat(obtainedUsers).extracting("email").containsExactlyInAnyOrder("peter@mail.com", "lisa@mail.com");
  }
}
```


Let’s understand what is happening in this test.

- We have annotated the test class with the `@SpringBootTest` so the test will run by starting the application context to be used in our test.
- We have created an instance of a *PostgreSQLContainer* using the Docker image provided by Application Collection. The Postgres container is created and started as soon as the class is loaded, as it’s defined in a static block.
- We have registered the database connection properties dynamically obtained from the Postgres container using Spring Boot’s `DynamicPropertySource`.
- We have initialized test data before each test using Junit5 `@BeforeEach` callback method, which is executed before every test method. Similarly, we have cleaned all test data after each test using `@AfterEach` callback method.
- Finally, in the `getAllUsers()` test we have invoked the `GET /api/users` endpoint and verified that it returns all the users in the DB.

### Run the tests

Before running your tests, make sure to configure proper authentication to Application Collection by any of the methods defined [in this section](index.html#handle-authentication).

Once done, you can run your tests.


```
mvn test
```


You should see how the Postgres docker container is pulled from Application Collection registry, started and all tests should PASS.


```
10:09:33.453 [main] INFO org.testcontainers.images.PullPolicy -- Image pull policy will be performed by: DefaultPullPolicy()
10:09:33.455 [main] INFO org.testcontainers.utility.ImageNameSubstitutor -- Image name substitution will be performed by: DefaultImageNameSubstitutor (composite of 'ConfigurationFileImageNameSubstitutor' and 'PrefixingImageNameSubstitutor')
10:09:33.565 [main] INFO org.testcontainers.dockerclient.DockerClientProviderStrategy -- Loaded org.testcontainers.dockerclient.UnixSocketClientProviderStrategy from ~/.testcontainers.properties, will try it first
10:09:33.669 [main] INFO org.testcontainers.dockerclient.DockerClientProviderStrategy -- Found Docker environment with local Unix socket (unix:///var/run/docker.sock)
10:09:33.670 [main] INFO org.testcontainers.DockerClientFactory -- Docker host IP address is localhost
10:09:33.675 [main] INFO org.testcontainers.DockerClientFactory -- Connected to docker: 
  Server Version: 26.0.0
  API Version: 1.45
  Operating System: Docker Desktop
  Total Memory: 7840 MB
10:09:33.708 [main] INFO tc.testcontainers/ryuk:0.6.0 -- Creating container for image: testcontainers/ryuk:0.6.0
10:09:33.766 [main] INFO org.testcontainers.utility.RegistryAuthLocator -- Credential helper/store (docker-credential-desktop) does not have credentials for https://index.docker.io/v1/
10:09:35.248 [main] INFO tc.testcontainers/ryuk:0.6.0 -- Container testcontainers/ryuk:0.6.0 is starting: f33d89fbe15ac59c2abcddf8ec83bc2f22201cae3423931cf9dc003db63c623b
10:09:35.858 [main] INFO tc.testcontainers/ryuk:0.6.0 -- Container testcontainers/ryuk:0.6.0 started in PT2.150678S
10:09:35.877 [main] INFO org.testcontainers.utility.RyukResourceReaper -- Ryuk started - will monitor and terminate Testcontainers containers on JVM exit
10:09:35.877 [main] INFO org.testcontainers.DockerClientFactory -- Checking the system...
10:09:35.877 [main] INFO org.testcontainers.DockerClientFactory -- ✔︎ Docker server version should be at least 1.6.0
10:09:35.877 [main] INFO tc.dp.apps.rancher.io/containers/postgresql:15.5-3.1 -- Creating container for image: dp.apps.rancher.io/containers/postgresql:15.5-3.1
10:09:35.934 [main] INFO tc.dp.apps.rancher.io/containers/postgresql:15.5-3.1 -- Container dp.apps.rancher.io/containers/postgresql:15.5-3.1 is starting: 156b44a31d7dd0a495ac9fa048e0ac3855e38fcf5e375037b659a1a440b4c701
10:09:36.951 [main] INFO tc.dp.apps.rancher.io/containers/postgresql:15.5-3.1 -- Container dp.apps.rancher.io/containers/postgresql:15.5-3.1 started in PT1.073745S
10:09:36.952 [main] INFO tc.dp.apps.rancher.io/containers/postgresql:15.5-3.1 -- Container is started (JDBC URL: jdbc:postgresql://localhost:51065/demo?loggerLevel=OFF)
10:09:37.072 [main] INFO org.springframework.test.context.support.AnnotationConfigContextLoaderUtils -- Could not detect default configuration classes for test class [com.suse.rancher.apps.demo.testcontainers.UserControllerIT]: UserControllerIT does not declare any static, non-private, non-final, nested classes annotated with @Configuration.
10:09:37.115 [main] INFO org.springframework.boot.test.context.SpringBootTestContextBootstrapper -- Found @SpringBootConfiguration com.suse.rancher.apps.demo.testcontainers.ApplicationCollectionApplication for test class com.suse.rancher.apps.demo.testcontainers.UserControllerIT

  .   ____          _            __ _ _
 /\\ / ___'_ __ _ _(_)_ __  __ _ \ \ \ \
( ( )\___ | '_ | '_| | '_ \/ _` | \ \ \ \
 \\/  ___)| |_)| | | | | || (_| |  ) ) ) )
  '  |____| .__|_| |_|_| |_\__, | / / / /
 =========|_|==============|___/=/_/_/_/
 :: Spring Boot ::                (v3.2.5)

2024-05-03T10:09:37.282+02:00  INFO 93561 --- [ApplicationCollection] [           main] c.s.r.a.d.t.UserControllerIT             : Starting UserControllerIT using Java 20.0.2 with PID 93561 (started by crodriguez in /Users/crodriguez/workspace/testcontainers)
2024-05-03T10:09:37.283+02:00  INFO 93561 --- [ApplicationCollection] [           main] c.s.r.a.d.t.UserControllerIT             : No active profile set, falling back to 1 default profile: "default"
2024-05-03T10:09:37.517+02:00  INFO 93561 --- [ApplicationCollection] [           main] .s.d.r.c.RepositoryConfigurationDelegate : Bootstrapping Spring Data JPA repositories in DEFAULT mode.
2024-05-03T10:09:37.541+02:00  INFO 93561 --- [ApplicationCollection] [           main] .s.d.r.c.RepositoryConfigurationDelegate : Finished Spring Data repository scanning in 21 ms. Found 1 JPA repository interface.
2024-05-03T10:09:37.698+02:00  INFO 93561 --- [ApplicationCollection] [           main] com.zaxxer.hikari.HikariDataSource       : HikariPool-1 - Starting...
2024-05-03T10:09:39.752+02:00  INFO 93561 --- [ApplicationCollection] [           main] com.zaxxer.hikari.pool.HikariPool        : HikariPool-1 - Added connection org.postgresql.jdbc.PgConnection@521ba38f
2024-05-03T10:09:39.752+02:00  INFO 93561 --- [ApplicationCollection] [           main] com.zaxxer.hikari.HikariDataSource       : HikariPool-1 - Start completed.
2024-05-03T10:09:39.919+02:00  INFO 93561 --- [ApplicationCollection] [           main] o.hibernate.jpa.internal.util.LogHelper  : HHH000204: Processing PersistenceUnitInfo [name: default]
2024-05-03T10:09:39.938+02:00  INFO 93561 --- [ApplicationCollection] [           main] org.hibernate.Version                    : HHH000412: Hibernate ORM core version 6.4.4.Final
2024-05-03T10:09:39.951+02:00  INFO 93561 --- [ApplicationCollection] [           main] o.h.c.internal.RegionFactoryInitiator    : HHH000026: Second-level cache disabled
2024-05-03T10:09:40.036+02:00  INFO 93561 --- [ApplicationCollection] [           main] o.s.o.j.p.SpringPersistenceUnitInfo      : No LoadTimeWeaver setup: ignoring JPA class transformer
2024-05-03T10:09:40.790+02:00  INFO 93561 --- [ApplicationCollection] [           main] o.h.e.t.j.p.i.JtaPlatformInitiator       : HHH000489: No JTA platform available (set 'hibernate.transaction.jta.platform' to enable JTA platform integration)
2024-05-03T10:09:40.791+02:00  INFO 93561 --- [ApplicationCollection] [           main] j.LocalContainerEntityManagerFactoryBean : Initialized JPA EntityManagerFactory for persistence unit 'default'
2024-05-03T10:09:40.941+02:00  WARN 93561 --- [ApplicationCollection] [           main] JpaBaseConfiguration$JpaWebConfiguration : spring.jpa.open-in-view is enabled by default. Therefore, database queries may be performed during view rendering. Explicitly configure spring.jpa.open-in-view to disable this warning
2024-05-03T10:09:41.087+02:00  INFO 93561 --- [ApplicationCollection] [           main] c.s.r.a.d.t.UserControllerIT             : Started UserControllerIT in 3.924 seconds (process running for 7.857)
OpenJDK 64-Bit Server VM warning: Sharing is only supported for boot loader classes because bootstrap classpath has been appended
2024-05-03T10:09:41.433+02:00  INFO 93561 --- [ApplicationCollection] [           main] o.s.mock.web.MockServletContext          : Initializing Spring TestDispatcherServlet ''
2024-05-03T10:09:41.433+02:00  INFO 93561 --- [ApplicationCollection] [           main] o.s.t.web.servlet.TestDispatcherServlet  : Initializing Servlet ''
2024-05-03T10:09:41.434+02:00  INFO 93561 --- [ApplicationCollection] [           main] o.s.t.web.servlet.TestDispatcherServlet  : Completed initialization in 0 ms
2024-05-03T10:09:41.654+02:00  INFO 93561 --- [ApplicationCollection] [ionShutdownHook] j.LocalContainerEntityManagerFactoryBean : Closing JPA EntityManagerFactory for persistence unit 'default'
2024-05-03T10:09:41.654+02:00  INFO 93561 --- [ApplicationCollection] [ionShutdownHook] com.zaxxer.hikari.HikariDataSource       : HikariPool-1 - Shutdown initiated...
2024-05-03T10:09:41.656+02:00  INFO 93561 --- [ApplicationCollection] [ionShutdownHook] com.zaxxer.hikari.HikariDataSource       : HikariPool-1 - Shutdown completed.

Process finished with exit code 0
```


Last modified September 9, 2025


