# Projet de base — IFT359 : Programmation Fonctionnelle

Projet de démarrage pour la réalisation des travaux pratiques et laboratoires en TypeScript.

## Prérequis

- [Node.js](https://nodejs.org/) (version LTS recommandée)

## Installation

Une fois Node.js installé, ouvrez un terminal à la racine du projet et exécutez la commande `npm install` pour installer les dépendances nécessaires.

## Structure du projet

- Le code source TypeScript se trouve dans le répertoire `src/` (point d'entrée : `src/index.ts`).
- Le code JavaScript compilé est généré dans le répertoire `dist/`.

## Commandes disponibles

| Commande             | Description                                                                                   |
| :------------------- | :-------------------------------------------------------------------------------------------- |
| `npm run dev`        | Exécute le code TypeScript.                                                                   |
| `npm run dev:watch`  | Exécute et surveille le code TypeScript avec rechargement automatique à chaque sauvegarde.    |
| `npm run build`      | Vérifie les types et compile le projet TypeScript vers JavaScript dans le dossier `dist/src`. |
| `npm start`          | Exécute le code JavaScript compilé (`dist/src/index.js`) avec Node.js.                        |
| `npm run clean`      | Supprime le dossier `dist/` contenant les fichiers compilés.                                  |
| `npm run test`       | Exécute les tests.                                                                            |
| `npm run test:watch` | Exécute les tests et surveille le code TypeScript                                             |

# Laboratoire - Gestion d'erreur avec Option et Result

## Mise en contexte

Dans ce laboratoire, vous devez implémenter la logique métier du module de **promotion des employés** d'une entreprise (`src/logique-metier.ts`) sans jamais utiliser `throw`, `try/catch`, ni `null`/`undefined`.

Le système utilise deux sources externes qui peuvent échouer (définies dans `src/model.ts`) :

1. **La base de données (`EmployeRepository`)** :
   - `trouverParId(id)` retourne un `Option<Employe>`
   - `sauvegarder(emp)` retourne un `Result<"ErreurEcritureDisque", Employe>`.
2. **Le service Web d'accréditation (`ServiceWebAccreditation`)** :
   - `recupererCertification(id)` simule un appel HTTP et retourne un `Result<"ServiceIndisponible" | "ReponseInvalide", InfoCertificationWeb>`.

Toutes les erreurs métier possibles lors d'une promotion sont regroupées dans le type `ErreurPromotion` (`src/model.ts`).

Contrairement à une signature impérative `promouvoirEmploye(id: number): Employe` qui cache ses cas d'échec (exceptions réseau, disque, `null`), une signature fonctionnelle `promouvoirEmploye(id: number): Result<ErreurPromotion, Employe>` rend le contrat explicite et vérifié par le compilateur.

> **Note :** Les modules `src/libs/option.ts` et `src/libs/result.ts` offrent à la fois des fonctions pures (`map`, `flatMap`, `mapError`, `filter`, `toResult`, `toOption`, `getOrElse`) vues en classe et un wrapper avec une API fluide (`option(...)` et `result(...)`) permettant de chaîner les opérations (`.map(...)`, `.flatMap(...)`, `.mapError(...)`, `.filter(...)`, `.toResult(...)`, `.toOption()`, `.unwrap()`). Ne pas oublier le `.unwrap()` à la fin de la chaîne pour récupérer l'Option ou le Result final.

---

## Cas d'exemple : `validerCertification`

On souhaite récupérer la certification d'un employé via le service Web et vérifier:

1. Si le service Web échoue, l'erreur doit être convertie en `{ type: "EchecServiceWeb", cause }`.
1. L'employé doit être accrédité (`accredite === true`), sinon on retourne l'erreur `{ type: "NonAccredite" }`.
1. Son score d'examen doit être d'au moins `75` (`scoreExamen >= 75`), sinon on retourne `{ type: "ScoreInsuffisant", score: c.scoreExamen, requis: 75 }`.

### Approche par composition de fonctions

```ts
export function validerCertification(
  apiWeb: ServiceWebAccreditation,
  id: number,
): Result<ErreurPromotion, InfoCertificationWeb> {
  return flatMap(
    flatMap(
      mapError<"ServiceIndisponible" | "ReponseInvalide", ErreurPromotion, InfoCertificationWeb>(
        apiWeb.recupererCertification(id),
        (e) => ({
          type: "EchecServiceWeb",
          cause: e,
        }),
      ),
      (c) => (c.accredite ? value(c) : error({ type: "NonAccredite" })),
    ),
    (c) => (c.scoreExamen >= 75 ? value(c) : error({ type: "ScoreInsuffisant", score: c.scoreExamen, requis: 75 })),
  );
}
```

### Approche équivalente avec le wrapper fluide `result(...)`

```ts
export function validerCertification(
  apiWeb: ServiceWebAccreditation,
  id: number,
): Result<ErreurPromotion, InfoCertificationWeb> {
  return result(apiWeb.recupererCertification(id))
    .mapError<ErreurPromotion>((e) => ({ type: "EchecServiceWeb", cause: e }))
    .flatMap((c) => (c.accredite ? value(c) : error({ type: "NonAccredite" })))
    .flatMap((c) =>
      c.scoreExamen >= 75 ? value(c) : error({ type: "ScoreInsuffisant", score: c.scoreExamen, requis: 75 }),
    )
    .unwrap();
}
```

---

## Exercices à implémenter

Implémentez les 4 exercices suivants dans `src/logique-metier.ts` en combinant `Option` et `Result`.

### Exercice 1 — De `Option` (BD) vers `Result` : `recupererEmployeActif`

```ts
export function recupererEmployeActif(repo: EmployeRepository, id: number): Result<ErreurPromotion, Employe>;
```

**Spécifications :**

1. Recherchez l'employé dans la BD à l'aide de `repo.trouverParId(id)` (qui retourne un `Option<Employe>`).
2. Convertissez cet `Option<Employe>` en `Result<ErreurPromotion, Employe>` à l'aide de `toResult` (ou `.toResult(...)` sur le wrapper `option(...)`) :
   - Si l'employé est absent de la BD (`None`), retournez l'erreur `{ type: "EmployeIntrouvable", id }`.
3. Utilisez ensuite `flatMap` pour vérifier que l'employé est actif (`employe.actif === true`). S'il est inactif, retournez `error({ type: "EmployeInactif", id })`.

---

### Exercice 2 — De `Option` (BD) et `Result` (API Web) vers `Option` : `obtenirNiveauEmploye`

```ts
export function obtenirNiveauEmploye(
  repo: EmployeRepository,
  apiWeb: ServiceWebAccreditation,
  id: number,
): Option<NiveauAccreditation>;
```

**Spécifications :**
On souhaite consulter le niveau de certification actuel (`"Junior" | "Intermediaire" | "Senior"`) d'un employé actif, sans conserver le détail des erreurs en cas d'échec :

1. Cherchez l'employé avec `repo.trouverParId(id)`.
2. Ne gardez l'employé que s'il est actif (`employe.actif === true`, sinon `none` — vous pouvez utiliser `filter` ou `flatMap`).
3. Appelez `apiWeb.recupererCertification(employe.id)` (`Result`) et convertissez-le en `Option` (avec `toOption` / `.toOption()`), puis :
   - Si l'employé est accrédité (`info.accredite === true`), retournez `some(info.niveau)`.
   - Si l'appel au service Web échoue ou que l'employé n'est pas accrédité, retournez `none`.

---

### Exercice 3 — Promotion : `promouvoirEmploye`

```ts
export function promouvoirEmploye(
  repo: EmployeRepository,
  apiWeb: ServiceWebAccreditation,
  id: number,
): Result<ErreurPromotion, Employe>;
```

**Spécifications :**
Combinez les étapes précédentes pour exécuter le processus complet de promotion d'un employé :

1. Récupérez l'employé actif en BD via `recupererEmployeActif(repo, id)`.
2. Validez sa certification auprès du service Web via `validerCertification(apiWeb, id)`.
3. Si les deux étapes réussissent, créez une copie mise à jour de l'employé avec son niveau d'accréditation approuvé (`niveauAccreditation: some(certif.niveau)`).
4. Sauvegardez ce nouvel employé dans la BD avec `sauvegarder(employePromu)`.
5. Si la sauvegarde échoue (`"ErreurEcritureDisque"`), transformez l'erreur en `{ type: "EchecSauvegarde" }`.

---

### Exercice 4 — Refactorisation : `obtenirGestionnaire`

```ts
export function obtenirGestionnaire(apiRH: ServiceRHLegacy, id: number): Result<ErreurDossierRH, string>;
```

**Mise en situation :**
La fonction `obtenirGestionnaire` est **déjà implémentée** dans `src/logique-metier.ts`, mais dans un style impératif classique utilisant `try / catch` et des vérifications `=== null` pour interagir avec `ServiceRHLegacy` (une API qui peut retourner `null` ou lancer des exceptions).

**Spécifications :**
Réécrivez le corps de `obtenirGestionnaire` de façon **100 % fonctionnelle** (sans `try/catch`, sans `if`, et sans `null`), tout en conservant le même comportement.

Indices: `tryCatch` (`src/libs/result.ts`), `fromNullable` (`src/libs/option.ts`).
