import enums from './enums.js'
import b from './3.1_b.js'
import { tv, requestInput, requestInputID } from './utils.js'

function tv_upb0(di, de, du) {
  requestInput(de, du, 'type_plancher_bas')
  let matcher = {
    enum_type_plancher_bas_id: de.enum_type_plancher_bas_id
  }
  const row = tv('upb0', matcher)
  if (row) {
    di.upb0 = Number(row.upb0)
    de.tv_upb0_id = Number(row.tv_upb0_id)
  } else {
    console.error('!! pas de valeur forfaitaire trouvée pour upb0 !!')
  }
}

function tv_upb(di, de, pc_id, zc, ej) {
  let matcher = {
    enum_periode_construction_id: pc_id,
    enum_zone_climatique_id: zc,
    effet_joule: ej
  }
  const row = tv('upb', matcher)
  if (row) {
    di.upb = Number(row.upb)
    de.tv_upb_id = Number(row.tv_upb_id)
  } else {
    console.error('!! pas de valeur forfaitaire trouvée pour upb !!')
  }
}

function ue_ranges(inputNumber, ranges) {
  const result = []

  if (inputNumber < ranges[0]) {
    result.push(ranges[0])
    result.push(ranges[1])
  }
  if (inputNumber > ranges[ranges.length - 1]) {
    result.push(ranges[ranges.length - 2])
    result.push(ranges[ranges.length - 1])
  }
  if (ranges.includes(inputNumber)) {
    result.push(inputNumber)
    result.push(inputNumber)
  } else {
    ranges.find((range, index) => {
      if (inputNumber < range) {
        if (index > 0) {
          result.push(ranges[index - 1])
        } else {
          result.push(ranges[index])
        }
        result.push(ranges[index])
        return true
      }
    })
  }
  return result
}

const values_2s_p = [3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 16, 18, 20]

function tv_ue(di, de, du, pc_id) {
  let type_adjacence = enums.type_adjacence[de.enum_type_adjacence_id]
  var type_adjacence_plancher
  var upb1, upb2
  if (type_adjacence === 'terre-plein') {
    if (Number(pc_id) < 7) {
      type_adjacence_plancher = 'terre plein bâtiment construit avant 2001'
      ;[upb1, upb2] = ue_ranges(di.upb, [0.46, 0.59, 0.85, 1.5, 3.4])
    } else {
      type_adjacence_plancher = 'terre plein bâtiment construit à partir de 2001'
      ;[upb1, upb2] = ue_ranges(di.upb, [0.31, 0.37, 0.46, 0.6, 0.85, 1.5, 3.4])
    }
  } else {
    type_adjacence_plancher = 'plancher sur vide sanitaire ou sous-sol non chauffé'
    ;[upb1, upb2] = ue_ranges(di.upb, [0.31, 0.34, 0.37, 0.41, 0.45, 0.83, 1.43, 3.33])
  }
  let surface_ue = requestInput(de, du, 'surface_ue', 'float') || de.surface_paroi_opaque
  let perimetre_ue = requestInput(de, du, 'perimetre_ue', 'float')
  let matcher = {
    type_adjacence_plancher: type_adjacence_plancher,
    '2s_p': Math.round((2 * surface_ue) / perimetre_ue)
  }
  // get 2s_p from surface_ue and perimetre_ue, choose from closest 2s_p_values
  matcher['2s_p'] = values_2s_p.reduce((prev, curr) => {
    return Math.abs(curr - matcher['2s_p']) < Math.abs(prev - matcher['2s_p']) ? curr : prev
  })
  matcher['2s_p'] = `^${matcher['2s_p']}$`
  let matcher_1 = { ...matcher, ...{ upb: String(upb1) } }
  let matcher_2 = { ...matcher, ...{ upb: String(upb2) } }
  const row_1 = tv('ue', matcher_1)
  const row_2 = tv('ue', matcher_2)
  const delta_ue = Number(row_2.ue) - Number(row_1.ue)
  const delta_upb = upb2 - upb1
  let ue
  if (delta_upb == 0) ue = Number(row_1.ue)
  else ue = Number(row_1.ue) + (delta_ue * (di.upb - upb1)) / delta_upb
  de.ue = ue
}

function calc_upb0(di, de, du) {
  let methode_saisie_u0 = requestInput(de, du, 'methode_saisie_u0')
  switch (methode_saisie_u0) {
    case 'type de paroi inconnu (valeur par défaut)':
    case 'déterminé selon le matériau et épaisseur à partir de la table de valeur forfaitaire':
      tv_upb0(di, de, du)
      break
    case 'saisie direct u0 justifiée à partir des documents justificatifs autorisés':
    case "saisie direct u0 correspondant à la performance de la paroi avec son isolation antérieure iti (umur_iti) lorsqu'il y a une surisolation ite réalisée":
      di.upb0 = requestInput(de, du, 'upb0_saisi', 'float')
      break
    case 'u0 non saisi car le u est saisi connu et justifié.':
      break
    default:
      console.warn('methode_saisie_u0 inconnue:', methode_saisie_u0)
  }
}

export default function calc_pb(pb, zc, pc_id, ej) {
  let de = pb.donnee_entree
  let du = {}
  let di = {}

  b(di, de, du, zc)

  let methode_saisie_u = requestInput(de, du, 'methode_saisie_u')
  switch (methode_saisie_u) {
    case 'non isolé':
      calc_upb0(di, de, du)
      di.upb = di.upb0
      break
    case 'epaisseur isolation saisie justifiée par mesure ou observation':
    case 'epaisseur isolation saisie justifiée à partir des documents justificatifs autorisés': {
      let e = requestInput(de, du, 'epaisseur_isolation', 'float') * 0.01
      calc_upb0(di, de, du)
      di.upb = 1 / (1 / di.upb0 + e / 0.042)
      break
    }
    case "resistance isolation saisie justifiée observation de l'isolant installé et mesure de son épaisseur":
    case 'resistance isolation saisie justifiée  à partir des documents justificatifs autorisés': {
      let r = requestInput(de, du, 'resistance_isolation', 'float')
      calc_upb0(di, de, du)
      di.upb = 1 / (1 / di.upb0 + r)
      break
    }
    case 'isolation inconnue  (table forfaitaire)':
    case "année d'isolation différente de l'année de construction saisie justifiée (table forfaitaire)": {
      let pi = requestInputID(de, du, 'periode_isolation')
      calc_upb0(di, de, du)
      tv_upb(di, de, pi, zc, ej)
      di.upb = Math.min(di.upb, di.upb0)
      break
    }
    case 'année de construction saisie (table forfaitaire)': {
      /* var pi_id = pc_id */
      /* let pc = enums.periode_construction[pc_id]; */
      /* switch (pc) { */
      /*   case "avant 1948": */
      /*   case "1948-1974": */
      /*     pi_id = getKeyByValue(enums.periode_isolation, "1975-1977"); */
      /*     break; */
      /* } */
      calc_upb0(di, de, du)
      tv_upb(di, de, pc_id, zc, ej)
      di.upb = Math.min(di.upb, di.upb0)
      break
    }
    case 'saisie direct u justifiée  (à partir des documents justificatifs autorisés)':
    case 'saisie direct u depuis rset/rsee( etude rt2012/re2020)':
      di.upb = requestInput(de, du, 'upb_saisi', 'float')
      break
    default:
      console.warn('methode_saisie_u inconnue:', methode_saisie_u)
  }

  let type_adjacence = requestInput(de, du, 'type_adjacence')
  switch (type_adjacence) {
    case 'vide sanitaire':
    case 'sous-sol non chauffé':
    case 'terre-plein':
      tv_ue(di, de, du, pc_id)
      di.upb_final = de.ue
      break
    default:
      di.upb_final = di.upb
      break
  }

  pb.donnee_utilisateur = du
  pb.donnee_intermediaire = di
}