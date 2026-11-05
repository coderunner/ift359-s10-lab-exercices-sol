import { describe, expect, test } from "vitest";
import {
  obtenirGestionnaire,
  obtenirNiveauEmploye,
  promouvoirEmploye,
  recupererEmployeActif,
  validerCertification,
} from "../src/logique-metier.js";
import {
  Employe,
  EmployeRepository,
  InfoCertificationWeb,
  ServiceRHLegacy,
  ServiceWebAccreditation,
} from "../src/model.js";
import { none, some } from "../src/libs/option.js";
import { error, value } from "../src/libs/result.js";

const employeActif: Employe = {
  id: 1,
  nom: "Alice Tremblay",
  deptId: "TI",
  actif: true,
  niveauAccreditation: none,
};

const employeInactif: Employe = {
  id: 2,
  nom: "Bob Gagnon",
  deptId: "RH",
  actif: false,
  niveauAccreditation: none,
};

const certifValide: InfoCertificationWeb = {
  niveau: "Senior",
  scoreExamen: 85,
  accredite: true,
};

function creerRepoSimule(
  employes: Employe[] = [employeActif, employeInactif],
  echecSauvegarde = false,
): EmployeRepository {
  return {
    trouverParId: (id: number) => {
      const emp = employes.find((e) => e.id === id);
      return emp ? some(emp) : none;
    },
    sauvegarder: (emp: Employe) =>
      echecSauvegarde ? error("ErreurEcritureDisque") : value(emp),
  };
}

function creerApiWebSimulee(
  resultat: ReturnType<ServiceWebAccreditation["recupererCertification"]>,
): ServiceWebAccreditation {
  return {
    recupererCertification: () => resultat,
  };
}

describe("Exemple : validerCertification", () => {
  test("retourne la certification si elle est accréditée et le score >= 75", () => {
    const api = creerApiWebSimulee(value(certifValide));
    expect(validerCertification(api, 1)).toEqual(value(certifValide));
  });

  test("retourne EchecServiceWeb si le service Web est indisponible", () => {
    const api = creerApiWebSimulee(error("ServiceIndisponible"));
    expect(validerCertification(api, 1)).toEqual(
      error({ type: "EchecServiceWeb", cause: "ServiceIndisponible" }),
    );
  });

  test("retourne NonAccredite si accredite est false", () => {
    const api = creerApiWebSimulee(
      value({ ...certifValide, accredite: false }),
    );
    expect(validerCertification(api, 1)).toEqual(
      error({ type: "NonAccredite" }),
    );
  });

  test("retourne ScoreInsuffisant si scoreExamen < 75", () => {
    const api = creerApiWebSimulee(value({ ...certifValide, scoreExamen: 60 }));
    expect(validerCertification(api, 1)).toEqual(
      error({ type: "ScoreInsuffisant", score: 60, requis: 75 }),
    );
  });
});

describe("Exercice 1 : recupererEmployeActif", () => {
  test("retourne Value(employe) si l'employé existe et est actif", () => {
    const repo = creerRepoSimule();
    expect(recupererEmployeActif(repo, 1)).toEqual(value(employeActif));
  });

  test("retourne Error(EmployeIntrouvable) si l'employé n'existe pas en BD", () => {
    const repo = creerRepoSimule();
    expect(recupererEmployeActif(repo, 99)).toEqual(
      error({ type: "EmployeIntrouvable", id: 99 }),
    );
  });

  test("retourne Error(EmployeInactif) si l'employé existe mais est inactif", () => {
    const repo = creerRepoSimule();
    expect(recupererEmployeActif(repo, 2)).toEqual(
      error({ type: "EmployeInactif", id: 2 }),
    );
  });
});

describe("Exercice 2 : obtenirNiveauEmploye", () => {
  test("retourne Some(niveau) si l'employé est actif et accrédité", () => {
    const repo = creerRepoSimule();
    const api = creerApiWebSimulee(value(certifValide));
    expect(obtenirNiveauEmploye(repo, api, 1)).toEqual(some("Senior"));
  });

  test("retourne None si l'employé est introuvable en BD", () => {
    const repo = creerRepoSimule();
    const api = creerApiWebSimulee(value(certifValide));
    expect(obtenirNiveauEmploye(repo, api, 99)).toEqual(none);
  });

  test("retourne None si l'employé est inactif", () => {
    const repo = creerRepoSimule();
    const api = creerApiWebSimulee(value(certifValide));
    expect(obtenirNiveauEmploye(repo, api, 2)).toEqual(none);
  });

  test("retourne None si l'appel au service Web échoue", () => {
    const repo = creerRepoSimule();
    const api = creerApiWebSimulee(error("ReponseInvalide"));
    expect(obtenirNiveauEmploye(repo, api, 1)).toEqual(none);
  });

  test("retourne None si l'employé n'est pas accrédité", () => {
    const repo = creerRepoSimule();
    const api = creerApiWebSimulee(
      value({ ...certifValide, accredite: false }),
    );
    expect(obtenirNiveauEmploye(repo, api, 1)).toEqual(none);
  });
});

describe("Exercice 3 : promouvoirEmploye", () => {
  test("promeut et sauvegarde l'employé avec son niveauAccreditation approuvé lorsque tout est valide", () => {
    const repo = creerRepoSimule();
    const api = creerApiWebSimulee(value(certifValide));
    expect(promouvoirEmploye(repo, api, 1)).toEqual(
      value({
        ...employeActif,
        niveauAccreditation: some("Senior"),
      }),
    );
  });

  test("échoue avec EmployeIntrouvable si l'employé n'existe pas", () => {
    const repo = creerRepoSimule();
    const api = creerApiWebSimulee(value(certifValide));
    expect(promouvoirEmploye(repo, api, 99)).toEqual(
      error({ type: "EmployeIntrouvable", id: 99 }),
    );
  });

  test("échoue avec EmployeInactif si l'employé est inactif", () => {
    const repo = creerRepoSimule();
    const api = creerApiWebSimulee(value(certifValide));
    expect(promouvoirEmploye(repo, api, 2)).toEqual(
      error({ type: "EmployeInactif", id: 2 }),
    );
  });

  test("échoue avec ScoreInsuffisant si la certification n'a pas le score requis", () => {
    const repo = creerRepoSimule();
    const api = creerApiWebSimulee(value({ ...certifValide, scoreExamen: 70 }));
    expect(promouvoirEmploye(repo, api, 1)).toEqual(
      error({ type: "ScoreInsuffisant", score: 70, requis: 75 }),
    );
  });

  test("échoue avec EchecSauvegarde si l'écriture en BD échoue", () => {
    const repo = creerRepoSimule([employeActif], true);
    const api = creerApiWebSimulee(value(certifValide));
    expect(promouvoirEmploye(repo, api, 1)).toEqual(
      error({ type: "EchecSauvegarde" }),
    );
  });
});

describe("Exercice 4 : obtenirGestionnaire", () => {
  test("retourne le nom du gestionnaire lorsque le dossier est complet", () => {
    const apiRH: ServiceRHLegacy = {
      chercherDossier: (id) => ({ id, gestionnaire: "Marie Curie" }),
    };
    expect(obtenirGestionnaire(apiRH, 1)).toEqual(value("Marie Curie"));
  });

  test("retourne DossierIntrouvable lorsque l'API retourne null", () => {
    const apiRH: ServiceRHLegacy = {
      chercherDossier: () => null,
    };
    expect(obtenirGestionnaire(apiRH, 42)).toEqual(
      error({ type: "DossierIntrouvable", id: 42 }),
    );
  });

  test("retourne AucunGestionnaire lorsque gestionnaire est null ou vide", () => {
    const apiRHNull: ServiceRHLegacy = {
      chercherDossier: (id) => ({ id, gestionnaire: null }),
    };
    const apiRHVide: ServiceRHLegacy = {
      chercherDossier: (id) => ({ id, gestionnaire: "   " }),
    };
    expect(obtenirGestionnaire(apiRHNull, 1)).toEqual(
      error({ type: "AucunGestionnaire", id: 1 }),
    );
    expect(obtenirGestionnaire(apiRHVide, 1)).toEqual(
      error({ type: "AucunGestionnaire", id: 1 }),
    );
  });

  test("retourne ErreurReseauRH lorsque l'API lance une exception", () => {
    const apiRH: ServiceRHLegacy = {
      chercherDossier: () => {
        throw new Error("Connexion refusée");
      },
    };
    expect(obtenirGestionnaire(apiRH, 1)).toEqual(
      error({ type: "ErreurReseauRH", message: "Connexion refusée" }),
    );
  });
});
