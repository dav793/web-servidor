
# Servidor Web

Para curso de Desarrollo Web

## Pasos para correr

* Instale las dependencias:
    ```bash
    npm install
    ```

* Corra el servidor web:
    ```bash
    npm run serve
    ```

## De interés

* El punto de entrada de la aplicación y encargado de la creación del servidor web es `index.js`. 

* La librería de utilidades está en `/modules/shared/util.js`. 

* El archivo de configuración que permite redefinir el puerto de escucha del servidor está en `/config/environment.js`.

* La bitácora de solicitudes y respuestas se genera durante la ejecución en `/log/out.log`.

* El directorio público raíz el cual el servidor expone la red es `/www`

## Pruebas

### GET

```bash
# status 200
curl -i http://localhost:9090/index.html?param=value
```

```bash
# status 200
curl -i -H "Accept: text/html, image/gif" http://localhost:9090/index.html
```

```bash
# status 200
curl -i -H "Accept: image/gif" http://localhost:9090/imagen.gif
```

```bash
# status 200
curl -o output.jpeg -H "Accept: image/*" http://localhost:9090/imagen4.jpeg
```

```bash
# status 200
curl -o output.png -H "Accept: image/*" http://localhost:9090/imagen5.png
```

```bash
# falla con status 406
curl -i -H "Accept: image/gif" http://localhost:9090/index.html
```

### HEAD

```bash
# status 200
curl -i -I localhost:9090/index.html
```

```bash
# falla con status 406
curl -i -H "Accept: image/gif" http://localhost:9090/index.html
```

### POST

```bash
# status 200
curl -i -X POST -d "mensaje=Hola+Mundo" localhost:9090/proceso.html
```

```bash
# falla con status 406 
curl -i -H "Accept: image/gif" -X POST -d "mensaje=Hola+Mundo" localhost:9090/proceso.html
```

### OTROS

```bash
# falla con status 501
curl -i -H "Accept: */*" -X PUT -d "mensaje=Hola+Mundo" localhost:9090/proceso.html
```

### CGI

Cuando sea que el servidor respondería a una solicitud con un documento HTML, el servidor revisa las
variables codificadas en el cuerpo de la solicitud (si las hay) y las sustituye en el documento HTML
antes de enviar la respuesta.

Es posible definir las posiciones donde se reemplazará por las variables escribiendo %%variable%%, donde
'variable' es el nombre de la variable que se desea sustituír.

Por ejemplo, si llega una solicitud con el cuerpo `mensaje=Hola+Mundo`, y el documento HTML contiene
el texto `<html><body> %%mensaje%% </body></html>`, el HTML resultante será `<html><body> Hola Mundo </body></html>`.

## Status codes

* `200 - OK` 
    Request processed successfully.

* `404 - NOT FOUND` 
    Resource does not exist.

* `406 - NOT ACCEPTABLE` 
    Server can only respond with a resource other than specified in `Accept` header mime types.

* `501 - NOT IMPLEMENTED`
    Functionality not present.

## cURL arguments

* `-i` Include the response headers in the output

* `-H` Include a header. Example:
    ```bash
    curl -H "X-First-Name: Joe" ...
    ```

* `-X` Set request method. Example:
    ```bash
    curl -X POST ...
    ```
    
* `-I` Fetch the headers only

* `-d` Send data in a POST request. Example:
    ```bash
    curl -X POST -d "mensaje=Hola+Mundo" ...
    ```
