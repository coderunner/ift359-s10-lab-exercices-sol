import { Option } from "./libs/option.js";
import { Result } from "./libs/result.js";

export type NiveauAccreditation = "Junior" | "Intermediaire" | "Senior";

export interface Employe {
  readonly id: number;
  readonly nom: string;
  readonly deptId: string;
  readonly actif: boolean;
  readonly niveauAccreditation: Option<NiveauAccreditation>;
}

// API de Repository : Simule le stockage en BD
export interface EmployeRepository {
  readonly trouverParId: (id: number) => Option<Employe>;
  readonly sauvegarder: (emp: Employe) => Result<"ErreurEcritureDisque", Employe>;
}

// Données fournies par le service Web externe de certification
export interface InfoCertificationWeb {
  readonly niveau: NiveauAccreditation;
  readonly scoreExamen: number; // 0 à 100
  readonly accredite: boolean;
}

// API Web externe (Service HTTP/Web) ---
export interface ServiceWebAccreditation {
  readonly recupererCertification: (
    id: number,
  ) => Result<"ServiceIndisponible" | "ReponseInvalide", InfoCertificationWeb>;
}

export type ErreurPromotion =
  | { readonly type: "EmployeIntrouvable"; readonly id: number }
  | { readonly type: "EmployeInactif"; readonly id: number }
  | {
      readonly type: "EchecServiceWeb";
      readonly cause: "ServiceIndisponible" | "ReponseInvalide";
    }
  | {
      readonly type: "ScoreInsuffisant";
      readonly score: number;
      readonly requis: number;
    }
  | { readonly type: "NonAccredite" }
  | { readonly type: "EchecSauvegarde" };

export interface DossierRHExterne {
  readonly id: number;
  readonly gestionnaire: string | null;
}

// API Web externe qui n'utilise ni Option ni Result
export interface ServiceRHLegacy {
  // Retourne null si le dossier n'existe pas,
  // ou lance une exception (throw Error) dans le cas d'erreur.
  chercherDossier(id: number): DossierRHExterne | null;
}

export type ErreurDossierRH =
  | { readonly type: "ErreurReseauRH"; readonly message: string }
  | { readonly type: "DossierIntrouvable"; readonly id: number }
  | { readonly type: "AucunGestionnaire"; readonly id: number };
