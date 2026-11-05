import {
  DossierRHExterne,
  Employe,
  EmployeRepository,
  ErreurDossierRH,
  ErreurPromotion,
  InfoCertificationWeb,
  NiveauAccreditation,
  ServiceRHLegacy,
  ServiceWebAccreditation,
} from "./model.js";

import * as Opt from "./libs/option.js";
import * as Res from "./libs/result.js";

// !!! Noter les imports en haut

/**
 * On souhaite récupérer la certification d'un employé via le service Web et vérifier:
 * - Si le service Web échoue, l'erreur doit être convertie en `{ type: "EchecServiceWeb", cause }`.
 * - L'employé doit être accrédité (`accredite === true`), sinon on retourne l'erreur `{ type: "NonAccredite" }`.
 * - Son score d'examen doit être d'au moins `75` (`scoreExamen >= 75`), sinon on retourne `{ type: "ScoreInsuffisant", score: c.scoreExamen, requis: 75 }`.
 */
export function validerCertification(
  apiWeb: ServiceWebAccreditation,
  id: number,
): Res.Result<ErreurPromotion, InfoCertificationWeb> {
  // Version impérative avec Result et Option
  //   const resApi = apiWeb.recupererCertification(id);
  //   if (Res.isError(resApi)) {
  //     return Res.error({ type: "EchecServiceWeb", cause: resApi.error });
  //   }
  //   const infoCert = resApi.value;
  //   if (!infoCert.accredite) {
  //     return Res.error({ type: "NonAccredite" });
  //   }
  //   if (infoCert.scoreExamen < 75) {
  //     return Res.error({ type: "ScoreInsuffisant", score: infoCert.scoreExamen, requis: 75 });
  //   }
  //   return resApi;

  // !!! Noter la spécification des génériques

  // Version fonctionnelle de pure
  // return Res.flatMap(
  //   Res.flatMap(
  //     Res.mapError<"ServiceIndisponible" | "ReponseInvalide", ErreurPromotion, InfoCertificationWeb>(
  //       apiWeb.recupererCertification(id),
  //       (e: "ServiceIndisponible" | "ReponseInvalide") => ({ type: "EchecServiceWeb", cause: e }),
  //     ),
  //     (infoCert) => (infoCert.accredite ? Res.value(infoCert) : Res.error({ type: "NonAccredite" })),
  //   ),
  //   (infoCert) =>
  //     infoCert.scoreExamen >= 75
  //       ? Res.value(infoCert)
  //       : Res.error({ type: "ScoreInsuffisant", score: infoCert.scoreExamen, requis: 75 }),
  // );

  // !!! Noter l'implémentation du wrapper
  // Version avec API fluide
  return Res.wrapResult(apiWeb.recupererCertification(id))
    .mapError<ErreurPromotion>((e) => ({ type: "EchecServiceWeb", cause: e }))
    .flatMap((c) => (c.accredite ? Res.value(c) : Res.error({ type: "NonAccredite" })))
    .flatMap((c) =>
      c.scoreExamen >= 75 ? Res.value(c) : Res.error({ type: "ScoreInsuffisant", score: c.scoreExamen, requis: 75 }),
    )
    .unwrap();
}

/**
 * EXERCICE 1 — De Option (BD) vers Result
 *
 * Spécifications :
 * 1. Recherchez l'employé dans la BD à l'aide de `repo.trouverParId(id)` (qui retourne un `Option<Employe>`).
 * 2. Convertissez cet `Option<Employe>` en `Result<ErreurPromotion, Employe>` à l'aide de `toResult`
 *    (ou `.toResult(...)` sur le wrapper `option(...)`) :
 *    - Si l'employé est absent de la BD (`None`), retournez l'erreur `{ type: "EmployeIntrouvable", id }`.
 * 3. Utilisez ensuite `flatMap` pour vérifier que l'employé est actif (`employe.actif === true`).
 *    S'il est inactif, retournez `error({ type: "EmployeInactif", id })`.
 */
export function recupererEmployeActif(repo: EmployeRepository, id: number): Res.Result<ErreurPromotion, Employe> {
  // Approche impérative traditionnelle (si retournait Employe | null)
  // const employe = repo.trouverParId(id);
  // if (employe === null) {
  //   throw new Error(`Employé ${id} introuvable`);
  // }
  // if (!employe.actif) {
  //   throw new Error(`Employé ${id} inactif`);
  // }
  // return employe;
  //
  // Version 1 : Sans wrapper
  //   const resAppel = Opt.toResult<ErreurPromotion, Employe>(repo.trouverParId(id), () => ({
  //     type: "EmployeIntrouvable",
  //     id,
  //   }));
  //   const resActif = Res.flatMap(resAppel, (e) => (e.actif ? Res.value(e) : Res.error({ type: "EmployeInactif", id })));
  //   return resActif;
  //
  // Version 2 : Avec wrapper
  return Opt.wrapOption(repo.trouverParId(id))
    .toResult<ErreurPromotion>(() => ({ type: "EmployeIntrouvable", id }))
    .flatMap((e) => (e.actif ? Res.value(e) : Res.error({ type: "EmployeInactif", id })))
    .unwrap();
}

/**
 * EXERCICE 2 — De Option (BD) et Result (API Web) vers Option
 *
 * Spécifications :
 * On souhaite consulter le niveau de certification actuel ("Junior" | "Intermediaire" | "Senior")
 * d'un employé actif, sans conserver le détail des erreurs en cas d'échec :
 * 1. Cherchez l'employé avec `repo.trouverParId(id)`.
 * 2. Ne gardez l'employé que s'il est actif (`employe.actif === true`, sinon `none` — vous pouvez utiliser `filter` ou `flatMap`).
 * 3. Appelez `apiWeb.recupererCertification(employe.id)` (`Result`) et convertissez-le en `Option` (avec `toOption` / `.toOption()`), puis :
 *    - Si l'employé est accrédité (`info.accredite === true`), retournez `some(info.niveau)`.
 *    - Si l'appel au service Web échoue ou que l'employé n'est pas accrédité, retournez `none`.
 */
export function obtenirNiveauEmploye(
  repo: EmployeRepository,
  apiWeb: ServiceWebAccreditation,
  id: number,
): Opt.Option<NiveauAccreditation> {
  return Opt.wrapOption(repo.trouverParId(id))
    .filter((e) => e.actif)
    .flatMap((e) => Res.toOption(apiWeb.recupererCertification(e.id)))
    .filter((info) => info.accredite)
    .map((info) => info.niveau)
    .unwrap();
}

/**
 * EXERCICE 3 — Promotion
 *
 * Spécifications :
 * Combinez les étapes précédentes pour exécuter le processus complet de promotion d'un employé :
 * 1. Récupérez l'employé actif en BD via `recupererEmployeActif(repo, id)`.
 * 2. Validez sa certification auprès du service Web via `validerCertification(apiWeb, id)`.
 * 3. Si les deux étapes réussissent, créez une copie mise à jour de l'employé avec son niveau
 *    d'accréditation approuvé (`niveauAccreditation: some(certif.niveau)`).
 * 4. Sauvegardez ce nouvel employé dans la BD avec `repo.sauvegarder(employePromu)`.
 * 5. Si la sauvegarde échoue (`"ErreurEcritureDisque"`), transformez l'erreur en `{ type: "EchecSauvegarde" }`.
 */
export function promouvoirEmploye(
  repo: EmployeRepository,
  apiWeb: ServiceWebAccreditation,
  id: number,
): Res.Result<ErreurPromotion, Employe> {
  return Res.wrapResult(recupererEmployeActif(repo, id))
    .flatMap((e) => Res.map(validerCertification(apiWeb, e.id), (info) => [e, info] as const))
    .flatMap((data) => {
      const [e, info] = data;
      const employePromu: Employe = {
        ...e,
        niveauAccreditation: Opt.some(info.niveau),
      };
      return Res.mapError(repo.sauvegarder(employePromu), () => ({
        type: "EchecSauvegarde",
      }));
    })
    .unwrap();
}

/**
 * EXERCICE 4 — Refactorisation
 *
 * Spécifications :
 * Réécrivez le corps de `obtenirGestionnaire` de façon 100 % fonctionnelle
 * (sans `try/catch`, sans `if`, et sans `null`), tout en conservant le même comportement.
 *
 * Indices : `tryCatch` (`src/libs/result.ts`), `fromNullable` (`src/libs/option.ts`).
 */
export function obtenirGestionnaire(apiRH: ServiceRHLegacy, id: number): Res.Result<ErreurDossierRH, string> {
  const resAppel = Res.tryCatch<ErreurDossierRH, Opt.Option<DossierRHExterne>>(
    () => {
      return Opt.fromNullable(apiRH.chercherDossier(id));
    },
    (err) => {
      return {
        type: "ErreurReseauRH",
        message: err instanceof Error ? err.message : "Erreur inconnue",
      };
    },
  );
  const resDossier = Res.flatMap(resAppel, (res) =>
    Opt.toResult<ErreurDossierRH, DossierRHExterne>(res, () => ({
      type: "DossierIntrouvable",
      id,
    })),
  );
  const resGestionnaire = Res.flatMap(resDossier, (d) => {
    const optGestionnaire = Opt.fromNullable(d.gestionnaire);
    const optNonVideGestionnaire = Opt.filter(optGestionnaire, (g) => g.trim() !== "");
    return Opt.toResult(optNonVideGestionnaire, () => ({ type: "AucunGestionnaire", id }));
  });
  return resGestionnaire;
}
