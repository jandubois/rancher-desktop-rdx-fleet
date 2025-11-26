# Background Documentation: Archive/Remove Recommendations

This document analyzes the `docs/background/` directory and recommends what to keep active, archive, or remove for the Fleet extension project.

## Summary

| Category | Files | Lines | Recommendation |
|----------|-------|-------|----------------|
| Keep Active | ~35 | ~15K | Core wikis, essential docs |
| Archive | 6 | ~90K | Repo dumps (regeneratable) |
| Remove | ~120 | ~7K | Irrelevant reference guides |

## KEEP ACTIVE

### DeepWiki Summaries (Highly Valuable)
These are well-organized, focused summaries - keep them for deep dives.

```
wiki/rancher/fleet/           # Fleet architecture, APIs, GitOps
wiki/rancherlabs/application-collection-extension/  # Blueprint for our extension
wiki/k3s-io/helm-controller/  # Helm Controller CRDs
```

### Essential Docker Extensions Docs
```
docker-extensions/extensions-sdk/
├── architecture/             # KEEP - extension structure
├── build/                    # KEEP - build tutorials
├── guides/                   # KEEP - kubernetes.md, invoke-host-binaries.md
├── dev/api/                  # KEEP - SDK API reference
├── quickstart.md             # KEEP
└── architecture.md           # KEEP
```

### Core Reference Files
```
README.md                     # KEEP - directory index
k3s-helm-controller.md        # KEEP - official K3s docs
spark-app-guide.md            # KEEP - UI design guidelines
```

## ARCHIVE (Move to docs/background/archive/)

These are large repo dumps that can be regenerated if needed. They bloat the context and are better accessed on-demand.

```
fleet-repo.txt                # 2.1MB - Full Fleet repo dump
fleet-docs-repo.txt           # 385KB - Fleet docs repo
appco-repo.txt                # 168KB - AppCo extension repo
docker-extensions-sdk-repo.txt # 71KB - Docker SDK repo
helm-controller-repo.txt      # 76KB - Helm controller repo
```

**Rationale**: The wikis contain the distilled knowledge. Raw repo dumps are only needed for specific code lookups, which can be done via GitHub directly.

## REMOVE

### AppCo Help - Specific Application Guides
These are end-user docs for specific apps in AppCo (Kafka, Redis, etc.) - not relevant for building the extension.

```
appco-help/reference-guides/
├── apache-ant.md
├── apache-kafka.md
├── argo-cd.md
├── clamav.md
├── coredns.md
├── external-dns.md
├── external-secrets-operator.md
├── git.md
├── go-fips.md
├── helm.md               # General Helm docs, not extension-specific
├── influxdb.md
├── istio.md
├── kiali.md
├── kubectl.md            # General kubectl docs
├── local-path-provisioner.md
├── mariadb.md
├── minio.md
├── nats.md
├── opensearch.md
├── opentelemetry-*.md
├── penpot.md
├── postgresql.md
├── redis.md
├── rust.md
├── valkey.md
└── velero.md
```

### AppCo Help - Integration Guides (Mostly Irrelevant)
Most of these are about integrating AppCo with other tools, not relevant.

```
appco-help/howto-guides/
├── integrate-with-dependency-track.md    # REMOVE
├── integrate-with-gitlab-cicd.md         # REMOVE
├── integrate-with-hauler.md              # REMOVE
├── integrate-with-test-containers.md     # REMOVE
├── mirror-with-artifactory.md            # REMOVE
├── mirror-with-harbor.md                 # REMOVE
├── mirror-with-sonatype-nexus.md         # REMOVE
├── use-metadata-rest-api-with-postman.md # REMOVE
├── verify-signatures-with-*.md           # REMOVE
└── integrate-with-rancher-manager.md     # MAYBE KEEP - if integrating with Rancher
```

### Docker Extensions - Design/Style Docs
We have our own design guidelines (spark-app-guide.md). These are generic Docker style guides.

```
docker-extensions/extensions-sdk/design/
├── design-guidelines.md          # REMOVE or KEEP as reference
├── design-guidelines/index.md    # REMOVE - duplicate
├── design-principles.md          # REMOVE
├── design-principles/index.md    # REMOVE - duplicate
├── mui-best-practices.md         # REMOVE
└── mui-best-practices/index.md   # REMOVE - duplicate
```

### Docker Extensions - Distribution/Publishing
Not relevant until we publish the extension.

```
docker-extensions/extensions-sdk/extensions/
├── DISTRIBUTION.md   # REMOVE for now
├── publish.md        # REMOVE for now
├── share.md          # REMOVE for now
├── validate.md       # REMOVE for now
└── labels.md         # KEEP - useful for metadata
```

## Recommended Directory Structure After Cleanup

```
docs/background/
├── README.md                    # Updated index
├── ARCHIVE_RECOMMENDATIONS.md   # This file
├── k3s-helm-controller.md       # K3s Helm docs
├── spark-app-guide.md           # UI design guidelines
│
├── wiki/                        # DeepWiki summaries
│   ├── rancher/fleet/           # Fleet wiki (KEEP ALL)
│   ├── rancherlabs/application-collection-extension/  # AppCo wiki (KEEP ALL)
│   └── k3s-io/helm-controller/  # Helm Controller wiki (KEEP ALL)
│
├── docker-extensions/           # Trimmed Docker SDK docs
│   └── extensions-sdk/
│       ├── architecture/        # KEEP
│       ├── build/               # KEEP
│       ├── dev/                 # KEEP
│       ├── guides/              # KEEP (kubernetes.md, invoke-host-binaries.md)
│       └── quickstart.md        # KEEP
│
├── appco-help/                  # Trimmed AppCo help
│   ├── index.md                 # KEEP
│   └── get-started/             # KEEP (authentication, first-steps)
│
└── archive/                     # Archived repo dumps
    ├── fleet-repo.txt
    ├── fleet-docs-repo.txt
    ├── appco-repo.txt
    ├── docker-extensions-sdk-repo.txt
    └── helm-controller-repo.txt
```

## Estimated Size Reduction

| Before | After | Reduction |
|--------|-------|-----------|
| 160 files | ~45 files | 72% |
| 112K lines | ~20K lines | 82% |
| ~3MB | ~500KB | 83% |

## Action Items

1. Create `docs/background/archive/` directory
2. Move the 6 large `.txt` repo dumps to archive
3. Delete AppCo reference guides (individual app docs)
4. Delete AppCo integration howto-guides
5. Delete Docker design/style docs (keep spark-app-guide.md instead)
6. Delete Docker distribution/publishing docs (not needed yet)
7. Update `docs/background/README.md` with new structure

## Note

The curated reference docs in `docs/reference/` should be the primary source during implementation. The `docs/background/` materials are for deeper research when needed.
