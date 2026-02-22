{
  description = "FFXIV Ember Overlay";

  inputs = {
    nixpkgs.url = "https://flakehub.com/f/NixOS/nixpkgs/0";
  };

  outputs =
    { self, nixpkgs }:
    let
      allSystems = [
        "aarch64-darwin"
      ];

      forAllSystems =
        f:
        nixpkgs.lib.genAttrs allSystems (
          system:
          f {
            inherit system;
            pkgs = import nixpkgs { inherit system; };
          }
        );
    in
    {
      packages = forAllSystems (
        { pkgs, ... }:
        {
          default = pkgs.buildNpmPackage {
            pname = "ffxiv-ember-overlay";
            version = "1.9.7";
            src = ./.;

            nodejs = pkgs.nodejs_20;
            npmDepsHash = "sha256-0bvWIDEjz/X/6S0OA4wPvm/mT9jxhb+oyZ1XHfo2I3o=";

            NODE_OPTIONS = "--openssl-legacy-provider";
            SKIP_PREFLIGHT_CHECK = "true";
            DISABLE_ESLINT_PLUGIN = "true";

            # Production env vars (normally set by env-cmd from .env-cmdrc)
            REACT_APP_ROUTER_BASE = "/";
            REACT_APP_HTTP_BASE = "/";
            REACT_APP_REDIRECT_URL = "https://ffxiv.kevin.jp";
            REACT_APP_VERSION = "0.1.0";
            REACT_APP_GITHUB_URL = "https://github.com/kevingriffin/ffxiv-ember-overlay";
            REACT_APP_DISCORD_URL = "https://discord.gg/invite";
            REACT_APP_CHANGELOG_URL = "https://github.com/kevingriffin/ffxiv-ember-overlay/blob/master/CHANGELOG.md";
            REACT_APP_PAGE_TITLE = "Production Environment";
            REACT_APP_ENV = "production";

            postPatch = ''
              cp CHANGELOG.md public/logs/
            '';

            buildPhase = ''
              npx craco build
            '';

            installPhase = ''
              cp -r build $out
            '';
          };
        }
      );

      apps = forAllSystems (
        { pkgs, system, ... }:
        {
          deploy = {
            type = "app";
            program = toString (
              pkgs.writeShellScript "deploy" ''
                ${pkgs.rsync}/bin/rsync -avz --delete ${self.packages.${system}.default}/ tomoyo:/var/www/ffxiv.kevin.jp/
              ''
            );
          };
        }
      );

      devShells = forAllSystems (
        { pkgs, ... }:
        {
          default = pkgs.mkShell {
            packages = with pkgs; [
              nodejs_20
            ];
          };
        }
      );
    };
}
