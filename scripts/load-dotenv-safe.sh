#!/bin/sh

load_dotenv_safe() {
  env_file="$1"
  [ -f "$env_file" ] || return 0

  while IFS= read -r line || [ -n "$line" ]; do
    line=${line%}
    case "$line" in
      ''|\#*) continue ;;
      export\ *) line=${line#export } ;;
    esac
    case "$line" in
      *=*) ;;
      *) continue ;;
    esac

    key=${line%%=*}
    value=${line#*=}
    case "$key" in
      [A-Za-z_]*)
        case "$key" in
          *[!A-Za-z0-9_]*)
            echo "Skipping invalid dotenv key: $key" >&2
            continue
            ;;
        esac
        ;;
      *)
        echo "Skipping invalid dotenv key: $key" >&2
        continue
        ;;
    esac

    case "$value" in
      \"*\") value=${value#\"}; value=${value%\"} ;;
      \'*\') value=${value#\'}; value=${value%\'} ;;
    esac

    export "$key=$value"
  done < "$env_file"
}
