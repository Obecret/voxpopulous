export interface SiretValidationResult {
  isValid: boolean;
  siret: string;
  siren?: string;
  nic?: string;
  denomination?: string;
  codePostal?: string;
  commune?: string;
  error?: string;
}

// Validates SIRET format (14 digits)
// Note: Some public administration SIRETs (like Mairie de Paris) don't pass Luhn validation
// but are still valid official SIRET numbers
export function validateSiretFormat(siret: string): boolean {
  return /^\d{14}$/.test(siret);
}

// Optional Luhn checksum verification (for informational purposes)
export function validateSiretLuhn(siret: string): boolean {
  if (!/^\d{14}$/.test(siret)) {
    return false;
  }
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    let digit = parseInt(siret[i], 10);
    if (i % 2 === 0) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }
    sum += digit;
  }
  return sum % 10 === 0;
}

export async function validateSiret(siret: string): Promise<SiretValidationResult> {
  const cleanedSiret = siret.replace(/\s/g, '');
  
  if (!validateSiretFormat(cleanedSiret)) {
    return {
      isValid: false,
      siret: cleanedSiret,
      error: "Format SIRET invalide (14 chiffres requis)"
    };
  }

  const siren = cleanedSiret.substring(0, 9);
  const nic = cleanedSiret.substring(9, 14);

  return {
    isValid: true,
    siret: cleanedSiret,
    siren,
    nic
  };
}

export async function validateSiretWithSirene(siret: string): Promise<SiretValidationResult> {
  const basicValidation = await validateSiret(siret);
  if (!basicValidation.isValid) {
    return basicValidation;
  }

  try {
    const response = await fetch(
      `https://api.insee.fr/entreprises/sirene/V3.11/siret/${siret}`,
      {
        headers: {
          'Accept': 'application/json',
        }
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        return {
          ...basicValidation,
          isValid: false,
          error: "SIRET non trouvé dans la base SIRENE"
        };
      }
      if (response.status === 403) {
        console.log('SIRENE API requires authentication - using format validation only');
        return basicValidation;
      }
      console.error(`SIRENE API error: ${response.status}`);
      return basicValidation;
    }

    const data = await response.json();
    const etablissement = data.etablissement;
    const uniteLegale = etablissement?.uniteLegale;
    const adresse = etablissement?.adresseEtablissement;

    return {
      isValid: true,
      siret: basicValidation.siret,
      siren: basicValidation.siren,
      nic: basicValidation.nic,
      denomination: uniteLegale?.denominationUniteLegale || 
                    `${uniteLegale?.prenomUsuelUniteLegale || ''} ${uniteLegale?.nomUniteLegale || ''}`.trim(),
      codePostal: adresse?.codePostalEtablissement,
      commune: adresse?.libelleCommuneEtablissement
    };
  } catch (error) {
    console.error('Error calling SIRENE API:', error);
    return basicValidation;
  }
}
