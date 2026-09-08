# MODULE_ACCEPTANCE_REGISTER

Baseline: `origin/development` backend `cd446fb` / frontend `c83ab8b`.

## IN this freeze (accepted + present on snapshot)

| Module | Status | Backend runtime SHA | Frontend runtime SHA |
| --- | --- | --- | --- |
| Shared platform (auth, Prisma, health, SST, Aurora, shell) | RETAIN | snapshot | snapshot |
| Gatekeeper v1 | ACCEPTED | `ae901a5537b19be6d06301fb0c12ac5e44c21018` | `79fceb933f0076a4b98ce9020d9a9815436a3c54` |
| Brand Preview / Onboarding | ACCEPTED | `89d7dcc7e00c12b499850e2ff1c74364c4a83c19` | `cbef201c571c6493c0a83ca4a6be12963faa959d` |
| Brand Centre + BI P1 | ACCEPTED | `e066265d720b8f76516acb5063b9843faac5a85e` | `d89810cfcb70c780054357c6571e51f1f13e258c` |
| Product Intelligence V1 | ACCEPTED | `17214722dc20abf23c8dce935a58050a017f6639` | `6bc9659ec87d9b960caaf3c6314e0f4da7b2596f` |
| Brand Settings MVP | ACCEPTED (clone integrated) | `517531682f6286d5ee45bd48ec4e145e96d583a7` | snapshot |
| Chat Home / Brand Home V1 | ACCEPTED | `00e1299ec2e97497bc6d81aeda808d6edd3b482a` | `1cf2e3bd93425f60fb3d40692320078aea567794` |
| Brand Campaign / UCE | IN snapshot | snapshot | snapshot |
| Collaboration Brand + Phase G | ACCEPTED WITH DEBT | `b7c726c8e7fba114ee7a0c2b09aac7aaae698ec5` | `591abd3ad51c7d763df9e4c71b1998e2bba52d09` |
| C-01 Creator Entry | ACCEPTED | `3ec01751d28cfa60840ecf97d95c706f94c3dec9` | `b50c36fd4b99b6e0ec0718291d794d7a58353f4c` |
| C-05 Creator Settings + shell | ACCEPTED | `156d5834266077be7e2b6a2d459bae5489edbbd6` | `323658d4b147b95b5629ff8d91fa90b8fe9077e4` |
| C-03 Campaign Apply | ACCEPTED | `aebeb85fd6bba37f88c3805c213c61e7f63b2f5f` | `82ed3c9ef849be8353565a1901b6f5fb065c37e1` |
| Notifications / Data Extraction | INFRA retain | snapshot | snapshot |

## DEFERRED (accepted elsewhere, not pulled)

| Module | Why out | Bring-back SHA |
| --- | --- | --- |
| C-02A Creator Home | Parent leave-out. Shell Home mount remains; accepted Home content is not this freeze. | BE `4e082f67953f0d6b55fa791f2cea03c8aef28119` / FE `29e78397fc66676d0134c45aa0bb6af173fbe12b` |
| C-04 Creator Collaboration | Parent leave-out. Brand Collaboration stays. | BE `ec395bf5760b295dddd9c3f7e9c2f05485b6b743` (lineage) / FE `106de9988ea2d4bd534205b083f63ae7ecd1878c` |
| Brand Payouts v1 provider-disabled | Parent leave-out. Settings escrow/billing stay. Do not treat old `brand-payouts` folder as this module. | BE `a38102fd9662f1654c9572b19913b9e228385b73` / FE `25441dd4fd228bec4d6c9fe9f39c2297318b6167` |

## OUT of this freeze

| Module | Status |
| --- | --- |
| C-06 Creator Payouts | Execution not accepted; still in progress |
| Marketplace | OUT_OF_MVP |
| Co-Pilot / Creator Co-Pilot | OUT_OF_MVP |
| Creator Centre / Media Kit / Analytics | Deferred product; hidden |
| Live provider money / Meta App Review | Provider debt |
