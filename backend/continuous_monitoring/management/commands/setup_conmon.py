"""
ConMon Setup Management Command

Sets up a Continuous Monitoring profile from a framework library.
Can create profiles for FedRAMP, generic ConMon, or custom configurations.
"""

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction


class Command(BaseCommand):
    help = 'Set up a Continuous Monitoring profile from a framework library'

    def add_arguments(self, parser):
        parser.add_argument(
            '--framework',
            type=str,
            default='conmon-schedule',
            help='Framework to use: "conmon-schedule" (generic) or "fedramp-conmon-checklist" (FedRAMP)'
        )
        parser.add_argument(
            '--name',
            type=str,
            required=True,
            help='Name for the ConMon profile'
        )
        parser.add_argument(
            '--profile-type',
            type=str,
            default='custom',
            choices=[
                'fedramp_low', 'fedramp_moderate', 'fedramp_high',
                'iso_27001', 'soc_2', 'nist_csf',
                'cmmc_l1', 'cmmc_l2', 'cmmc_l3', 'custom'
            ],
            help='Profile type (default: custom)'
        )
        parser.add_argument(
            '--implementation-groups',
            type=str,
            nargs='+',
            help='Implementation groups to include (e.g., BASIC STANDARD or L M H)'
        )
        parser.add_argument(
            '--folder',
            type=str,
            help='Folder name or ID to create the profile in (uses Global if not specified)'
        )
        parser.add_argument(
            '--generate-tasks',
            action='store_true',
            default=True,
            help='Generate TaskTemplates and TaskNodes (default: True)'
        )
        parser.add_argument(
            '--no-generate-tasks',
            action='store_false',
            dest='generate_tasks',
            help='Skip generating tasks'
        )
        parser.add_argument(
            '--list-frameworks',
            action='store_true',
            help='List available ConMon frameworks and exit'
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be created without making changes'
        )

    def handle(self, *args, **options):
        from core.models import Framework, Folder
        from continuous_monitoring.services import ConMonTaskGenerator

        # List frameworks option
        if options['list_frameworks']:
            self._list_frameworks()
            return

        # Determine framework URN
        framework_key = options['framework']
        if framework_key == 'conmon-schedule':
            framework_urn = 'urn:ciso:risk:framework:conmon-schedule'
        elif framework_key == 'fedramp-conmon-checklist':
            framework_urn = 'urn:ciso:risk:framework:fedramp-conmon-checklist'
        elif framework_key.startswith('urn:'):
            framework_urn = framework_key
        else:
            raise CommandError(f"Unknown framework: {framework_key}")

        # Check if framework exists
        try:
            framework = Framework.objects.get(urn=framework_urn)
        except Framework.DoesNotExist:
            self.stderr.write(self.style.ERROR(
                f"Framework not found: {framework_urn}\n"
                "Run 'python manage.py storelibraries' to load the ConMon libraries."
            ))
            return

        # Get or create folder
        folder = self._get_folder(options.get('folder'))
        if not folder:
            raise CommandError("No folder available. Create a folder first.")

        # Determine implementation groups
        impl_groups = options.get('implementation_groups', [])
        if not impl_groups:
            # Default based on profile type
            profile_type = options['profile_type']
            if profile_type.startswith('fedramp'):
                level = profile_type.split('_')[1].upper()[0]  # L, M, or H
                impl_groups = [level]
            else:
                impl_groups = ['BASIC', 'STANDARD']  # Default for generic

        self.stdout.write(self.style.NOTICE(
            f"\nSetting up ConMon Profile:"
            f"\n  Name: {options['name']}"
            f"\n  Framework: {framework.name}"
            f"\n  Profile Type: {options['profile_type']}"
            f"\n  Implementation Groups: {impl_groups}"
            f"\n  Folder: {folder.name}"
            f"\n  Generate Tasks: {options['generate_tasks']}"
        ))

        if options['dry_run']:
            self.stdout.write(self.style.WARNING("\n[DRY RUN] No changes made."))
            return

        # Set up the profile
        with transaction.atomic():
            self.stdout.write("\nCreating profile and activities...")

            results = ConMonTaskGenerator.setup_from_framework(
                folder=folder,
                framework_urn=framework_urn,
                profile_name=options['name'],
                profile_type=options['profile_type'],
                implementation_groups=impl_groups
            )

            if results['errors']:
                for error in results['errors']:
                    self.stderr.write(self.style.ERROR(f"  Error: {error}"))
                raise CommandError("Errors occurred during setup")

            self.stdout.write(self.style.SUCCESS(
                f"  Created profile: {results['profile_id']}"
                f"\n  Activities created: {results['activities_created']}"
            ))

            # Generate tasks if requested
            if options['generate_tasks'] and results['profile_id']:
                from continuous_monitoring.models import ConMonProfile

                self.stdout.write("\nGenerating tasks...")

                profile = ConMonProfile.objects.get(id=results['profile_id'])
                generator = ConMonTaskGenerator(folder=folder)
                task_results = generator.generate_tasks_from_profile(profile)

                self.stdout.write(self.style.SUCCESS(
                    f"  Task templates created: {task_results['created_templates']}"
                    f"\n  Task templates updated: {task_results['updated_templates']}"
                    f"\n  Task nodes created: {task_results['created_nodes']}"
                ))

                if task_results['errors']:
                    for error in task_results['errors']:
                        self.stderr.write(self.style.WARNING(f"  Warning: {error}"))

        self.stdout.write(self.style.SUCCESS(
            f"\nConMon setup complete!"
            f"\nProfile ID: {results['profile_id']}"
        ))

    def _list_frameworks(self):
        """List available ConMon frameworks."""
        from core.models import Framework

        self.stdout.write(self.style.NOTICE("\nAvailable ConMon Frameworks:"))

        conmon_frameworks = Framework.objects.filter(
            urn__icontains='conmon'
        ).order_by('name')

        if not conmon_frameworks.exists():
            self.stdout.write(self.style.WARNING(
                "  No ConMon frameworks found."
                "\n  Run 'python manage.py storelibraries' to load the libraries."
            ))
            return

        for fw in conmon_frameworks:
            self.stdout.write(f"\n  {fw.name}")
            self.stdout.write(f"    URN: {fw.urn}")
            self.stdout.write(f"    Ref ID: {fw.ref_id}")

            # List implementation groups
            if hasattr(fw, 'implementation_groups_definition') and fw.implementation_groups_definition:
                groups = fw.implementation_groups_definition
                group_refs = [g.get('ref_id', '?') for g in groups]
                self.stdout.write(f"    Implementation Groups: {', '.join(group_refs)}")

    def _get_folder(self, folder_spec):
        """Get folder by name or ID, or return Global folder."""
        from iam.models import Folder

        if folder_spec:
            # Try by ID first
            try:
                return Folder.objects.get(id=folder_spec)
            except (Folder.DoesNotExist, ValueError):
                pass

            # Try by name
            try:
                return Folder.objects.get(name=folder_spec)
            except Folder.DoesNotExist:
                raise CommandError(f"Folder not found: {folder_spec}")

        # Return Global folder
        return Folder.get_root_folder()
