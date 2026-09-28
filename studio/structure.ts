import type {StructureResolver} from 'sanity/structure'

const API_VERSION = '2025-09-01'

export const structure: StructureResolver = (S) =>
  S.list()
    .title('Home Truth')
    .items([
      S.documentTypeListItem('project').title('Projects'),
      S.listItem()
        .title('Problems found')
        .child(
          S.documentList()
            .apiVersion(API_VERSION)
            .title('Mismatches and violations')
            .filter('_type == "finding" && status in ["mismatch", "violation"]'),
        ),
      S.listItem()
        .title('Claims to verify')
        .child(
          S.documentList()
            .apiVersion(API_VERSION)
            .title('Unverified claims')
            .filter('_type == "claim" && verified != true'),
        ),
      S.divider(),
      S.documentTypeListItem('finding').title('All findings'),
      S.documentTypeListItem('claim').title('All claims'),
      S.documentTypeListItem('sourceDocument').title('Source documents'),
      S.documentTypeListItem('attribute').title('Attributes'),
    ])
