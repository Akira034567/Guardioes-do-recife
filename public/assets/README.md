# Assets de runtime

- `levels/recife-one/background.png`: fundo jogável do Recife 1.
- `guardians/pistol-shrimp/level-0`: aparência base do Camarão.
- `guardians/pistol-shrimp/level-1`: aparência depois do primeiro upgrade.
- `guardians/pistol-shrimp/level-2`: aparência depois do segundo upgrade.

Cada nível possui exatamente uma imagem `idle`, uma imagem `attack` e uma imagem `projectile`. O movimento passivo é feito por transformação, sem alternar imagens de níveis diferentes.

As chaves, caminhos e animações são registrados em `src/game/assets/recifeOneAssets.ts`.
